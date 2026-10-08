package hn.chingadazo.pos;
import java.io.*;
import java.util.*;

/** One durable release per operator. Does not record payments or remove consumptions. */
final class NativeRelease {
    interface Gateway {Map<String,Object> read()throws IOException;Map<String,Object> send(Map<String,Object> command)throws IOException;}
    static final class Intent {
        final String operation,table,account;final long revision;
        Intent(String op,String table,String account,long revision){this.operation=op;this.table=table;this.account=account;this.revision=revision;}
        Map<String,Object> command(){return NativeAccess.map("action","release","accountId",account,"operationId",operation,"expectedRevision",revision);}
    }
    private final NativeDrafts.Store store;private final Gateway gateway;
    NativeRelease(NativeDrafts.Store store,Gateway gateway){this.store=store;this.gateway=gateway;}
    synchronized Intent pending(String owner)throws IOException{
        owner(owner);byte[] bytes=store.read(owner);if(bytes==null)return null;
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
            if(bytes.length>1024||in.readInt()!=1)throw NativeTables.invalid();boolean present=in.readBoolean();Intent result=null;
            if(present){String op=in.readUTF(),table=in.readUTF(),account=in.readUTF();long rev=in.readLong();
                NativeTables.key(NativeAccess.map("id",op),"id");NativeTables.key(NativeAccess.map("id",table),"id");NativeTables.key(NativeAccess.map("id",account),"id");
                if(op.length()>80||rev<0||rev>9007199254740991L)throw NativeTables.invalid();result=new Intent(op,table,account,rev);}
            if(in.read()!=-1)throw NativeTables.invalid();return result;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void save(String owner,Intent intent)throws IOException{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);out.writeInt(1);out.writeBoolean(intent!=null);
        if(intent!=null){out.writeUTF(intent.operation);out.writeUTF(intent.table);out.writeUTF(intent.account);out.writeLong(intent.revision);}out.flush();byte[] encoded=bytes.toByteArray();
        try{store.write(owner,encoded);}finally{Arrays.fill(encoded,(byte)0);}
    }
    synchronized NativeTables run(String owner,String table)throws IOException{
        return run(owner,table,null);
    }
    synchronized NativeTables run(String owner,String table,String expectedAccount)throws IOException{
        Intent intent=pending(owner);
        if(intent!=null&&expectedAccount!=null&&!expectedAccount.equals(intent.account))throw new IOException("Recupera primero la liberación de la cuenta anterior.");
        if(intent==null){
            NativeTables state=NativeTables.parse(gateway.read());
            if(table==null)return state;
            if(!state.tables.containsKey(table))throw NativeTables.invalid();
            if(state.account(table)==null)return state;
            if(expectedAccount!=null&&!expectedAccount.equals(state.account(table).id))throw new IOException("La mesa tiene otra cuenta. No se liberó esa ocupación.");
            if(!state.releasable(table))throw new IOException("La mesa tiene pago pendiente o sin confirmar. No se liberó.");
            intent=new Intent(UUID.randomUUID().toString(),table,state.account(table).id,state.revision);save(owner,intent);
        }else if(table!=null&&!table.equals(intent.table))throw new IOException("Hay una liberación pendiente. Consulta su resultado primero.");
        Map<String,Object> reply;
        try{reply=gateway.send(intent.command());}
        catch(NativeAccess.Failure e){
            if(e.status==409){
                NativeTables fresh=NativeTables.parse(gateway.read());NativeTables.Account a=fresh.account(intent.table);
                // A definite revision rejection plus the same paid occupation permits a NEW explicit attempt.
                if(a!=null&&a.id.equals(intent.account)&&fresh.releasable(intent.table)&&fresh.revision!=intent.revision){
                    save(owner,null);throw new IOException("El salón cambió. Actualiza y vuelve a tocar Liberar mesa; no se repitió el cobro.");
                }
            }throw e;
        }
        if(!intent.operation.equals(reply.get("operationId")))throw new IOException("Liberación sin confirmar. Consulta el mismo intento.");
        NativeTables state=NativeTables.parse(reply);
        if(!state.initialized||!state.tables.containsKey(intent.table)||state.accounts.containsKey(intent.account))throw new IOException("No se confirmó el estado final de la mesa. Conservamos el intento.");
        save(owner,null);return state;
    }
    private static void owner(String owner)throws IOException{if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeTables.invalid();}
}
