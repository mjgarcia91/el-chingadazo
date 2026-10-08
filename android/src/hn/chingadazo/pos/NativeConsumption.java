package hn.chingadazo.pos;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;

/** A new batch and its intent share one atomic encrypted draft record. No sales or printing. */
final class NativeConsumption {
    interface Gateway {
        Map<String,Object> read()throws IOException;
        void validate(Map<String,Object> command)throws IOException;
        Map<String,Object> send(Map<String,Object> command)throws IOException;
    }
    private final NativeDrafts drafts;private final Gateway gateway;private final String context;
    interface Accepted {default void validate(NativeDrafts.Draft batch)throws IOException{} void enqueue(String owner,NativeDrafts.Draft batch)throws IOException;}
    private final Accepted accepted;
    NativeConsumption(NativeDrafts drafts,Gateway gateway){this(drafts,gateway,"counter");}
    NativeConsumption(NativeDrafts drafts,Gateway gateway,String context){this(drafts,gateway,context,(owner,batch)->{if(batch.pending.kitchen)throw new IOException("Entrega de comanda no disponible; conserva el envío.");});}
    NativeConsumption(NativeDrafts drafts,Gateway gateway,String context,Accepted accepted){this.drafts=drafts;this.gateway=gateway;this.context=context;this.accepted=accepted;}
    NativeTables run(String owner,String table,long expected,String selectedAccount)throws IOException {
        return run(owner,table,expected,selectedAccount,false);
    }
    NativeTables run(String owner,String table,long expected,String selectedAccount,boolean kitchen)throws IOException {
        // Shared with local edits: another view cannot change a batch during its submission.
        synchronized(drafts){
            NativeDrafts.Draft draft=drafts.load(owner);
            boolean firstAttempt=draft.pending==null;
            if(draft.pending==null){
                if(table==null||draft.revision!=expected||draft.lines.isEmpty())throw new IOException("Revisa la cuenta antes de enviarla.");
                Map<String,Object> raw=gateway.read();NativeTables state=NativeTables.parse(raw);
                NativeTables.Table target=state.tables.get(table);NativeTables.Account account=state.account(table);
                if(!Boolean.TRUE.equals(raw.get("consumptionsEnabled"))||!state.initialized||target==null||!target.active||account!=null&&!account.status.equals("open"))
                    throw new IOException("La mesa no está disponible para agregar consumos. La cuenta se conserva.");
                if(!target.accountId.equals(selectedAccount))throw new IOException("La ocupación de la mesa cambió. Selecciona de nuevo; no se envió el pedido.");
                if(!NativeDraftContexts.destination(context,table,target.accountId))throw new IOException("Estos productos pertenecen a otra cuenta. No se movieron ni enviaron.");
                NativeDrafts.Pending pending=new NativeDrafts.Pending(UUID.randomUUID().toString(),table,target.accountId,state.revision,kitchen,Integer.toString(target.number));
                gateway.validate(command(new NativeDrafts.Draft(draft.revision,draft.lines,pending)));
                accepted.validate(new NativeDrafts.Draft(draft.revision,draft.lines,pending));
                draft=drafts.prepare(owner,expected,pending.operation,pending.table,pending.account,pending.revision,pending.kitchen,pending.label);
            }else if(table!=null&&!table.equals(draft.pending.table))throw new IOException("Primero recupera el envío pendiente de la otra mesa.");
            Map<String,Object> command=command(draft);gateway.validate(command);
            Map<String,Object> reply;
            try{reply=gateway.send(command);}
            catch(NativeAccess.Failure e){
                // Only a definite rejection of the FIRST request permits editing again.
                // A rejection on replay cannot disprove an earlier accepted request.
                if(firstAttempt&&(e.status==400||e.status==409||e.status==413)){
                    drafts.reject(owner,draft.pending.operation);
                    throw new IOException("El servidor rechazó el pedido. Conservamos los productos: actualiza catálogo y mesa antes de volver a enviarlo.");
                }throw e;
            }
            if(!draft.pending.operation.equals(reply.get("operationId")))throw new IOException("Envío sin confirmar. Conservamos la cuenta y el mismo intento.");
            NativeTables state=NativeTables.parse(reply);
            if(!state.initialized)throw NativeTables.invalid();
            // The server only echoes this ID after checking its persisted actor+command fingerprint.
            // The table may already have been paid/released on another terminal when replaying.
            accepted.enqueue(owner,draft);
            drafts.confirm(owner,draft.pending.operation);
            return state;
        }
    }
    static Map<String,Object> command(NativeDrafts.Draft draft)throws IOException {
        if(draft.pending==null||draft.lines.isEmpty())throw new IOException("No hay un envío pendiente.");
        List<Object> items=new ArrayList<>();
        for(NativeSales.Line line:draft.lines)items.add(Collections.unmodifiableMap(NativeAccess.map(
            "productId",line.productId,"qty",line.qty,"unit",BigDecimal.valueOf(line.unit,2),"mods",line.mods,"note",line.note)));
        NativeDrafts.Pending p=draft.pending;
        return Collections.unmodifiableMap(NativeAccess.map("action","consume","operationId",p.operation,"expectedRevision",p.revision,
            "tableId",p.table,"accountId",p.account,"items",Collections.unmodifiableList(items)));
    }
}
