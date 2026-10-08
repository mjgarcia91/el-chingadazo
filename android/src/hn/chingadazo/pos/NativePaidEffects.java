package hn.chingadazo.pos;
import java.io.IOException;
import java.text.Normalizer;
import java.util.*;

/** Generate commands only from a verified paid receipt, never from user-supplied ESC/POS. */
final class NativePaidEffects {
    static void validateDraft(List<NativeSales.Line> lines)throws IOException{
        List<Object> items=new ArrayList<>();for(NativeSales.Line line:lines)items.add(NativeAccess.map("name",line.name,"modsText",line.modsText,"note",line.note));validateSize(items);
    }
    static void validateSize(Object raw)throws IOException{
        if(!(raw instanceof List))throw NativeAccess.malformed();long size=1024;
        for(Object value:(List<?>)raw){Map<String,Object> line=NativeAccess.object(value);size+=120;
            for(String key:new String[]{"name","modsText","note"})if(line.get(key) instanceof String)size+=((String)line.get(key)).length();
        }
        if(size>47000)throw new IOException("El ticket supera el tamaño permitido. Reduce las notas antes de cobrar o elige sin imprimir.");
    }
    static Map<String,byte[]> kitchen(NativeDrafts.Draft batch)throws IOException{
        if(batch.pending==null||batch.lines.isEmpty())throw NativeAccess.malformed();
        Map<String,byte[]> jobs=new LinkedHashMap<>();if(!batch.pending.kitchen)return jobs;
        StringBuilder text=new StringBuilder("EL CHINGADAZO\nCOCINA - PRODUCTOS NUEVOS\nNO ES COMPROBANTE DE PAGO\n");
        text.append("Mesa / destino: ").append(batch.pending.label).append("\nLote: ").append(batch.pending.operation).append('\n');
        for(NativeSales.Line line:batch.lines)text.append(line.qty).append(" x ").append(ascii(line.name)).append('\n').append(ascii(line.modsText)).append('\n').append(ascii(line.note)).append('\n');
        text.append("\n\n");if(text.length()>48000)throw new IOException("Comanda demasiado larga; el pedido se conserva.");
        jobs.put("kitchen",PrinterCore.ticket(text.toString()));return jobs;
    }
    static Map<String,byte[]> create(NativeCheckout.Intent intent,Map<String,Object> receipt)throws IOException{
        if(!intent.confirmed)throw NativeAccess.malformed();NativeReceipt.validate(intent.expected,receipt);
        NativeReceipt.Expected e=intent.expected;
        return format(e.id,e.total,e.payment,e.received,intent.print,receipt);
    }
    static Map<String,byte[]> counter(String owner,NativeDrafts.Draft cart,Map<String,Object> sale)throws IOException{
        if(cart.payment==null||!cart.payment.confirmed)throw NativeAccess.malformed();NativeCounterCheckout.validate(owner,cart,sale);
        Map<String,byte[]> jobs=new LinkedHashMap<>();
        if(cart.payment.print&&cart.payment.kitchen)jobs.putAll(kitchen(new NativeDrafts.Draft(cart.revision,cart.lines,new NativeDrafts.Pending(cart.payment.id,"mostrador","",0,true))));
        jobs.putAll(format(cart.payment.id,NativeSales.total(cart.lines),cart.payment.method,cart.payment.received,cart.payment.print,sale));return jobs;
    }
    private static Map<String,byte[]> format(String id,long total,String payment,long received,boolean print,Map<String,Object> receipt)throws IOException{
        Map<String,byte[]> jobs=new LinkedHashMap<>();
        if(print){
            StringBuilder text=new StringBuilder("EL CHINGADAZO\nCOMPROBANTE DE PAGO\n");
            text.append(id).append('\n').append(receipt.get("paidAt")).append('\n');
            for(Object raw:(List<?>)receipt.get("items")){
                Map<String,Object> line=NativeAccess.object(raw);
                long qty=NativeTables.integer(line.get("qty"),1,50),unit=NativeTables.money(line.get("unit"));
                text.append(qty).append(" x ").append(ascii((String)line.get("name"))).append('\n');
                text.append(NativeSales.money(unit)).append(" = ").append(NativeSales.money(qty*unit)).append('\n');
                for(String key:new String[]{"modsText","note"})if(line.get(key) instanceof String&&!((String)line.get(key)).isEmpty())text.append(ascii((String)line.get(key))).append('\n');
            }
            text.append("TOTAL ").append(NativeSales.money(total)).append('\n').append(payment).append('\n');
            if(payment.equals("Efectivo"))text.append("RECIBIDO ").append(NativeSales.money(received)).append("\nCAMBIO ").append(NativeSales.money(received-total)).append('\n');
            text.append("Gracias por su visita\n\n\n");
            if(text.length()>48000)throw new IOException("Ticket demasiado largo; pago conservado.");
            byte[] withCut=PrinterCore.ticket(text.toString());
            jobs.put("client",Arrays.copyOf(withCut,withCut.length-3));jobs.put("cut",new byte[]{29,86,0});
        }
        if(payment.equals("Efectivo")&&received>total)jobs.put("drawer",PrinterCore.drawer());
        return jobs;
    }
    private static String ascii(String value){
        String normalized=Normalizer.normalize(value,Normalizer.Form.NFD);StringBuilder out=new StringBuilder();
        for(int i=0;i<normalized.length();i++){
            char c=normalized.charAt(i);if(Character.getType(c)==Character.NON_SPACING_MARK)continue;
            out.append(c>=32&&c<=126?c:' ');
        }
        return out.toString();
    }
}
