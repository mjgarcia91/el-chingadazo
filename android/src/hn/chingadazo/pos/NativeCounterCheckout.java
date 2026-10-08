package hn.chingadazo.pos;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;

/** Counter intent and products live in the SAME atomic draft record. */
final class NativeCounterCheckout {
    interface Gateway {Map<String,Object> read(String id)throws IOException;void send(Map<String,Object> body)throws IOException;}
    private final NativeDrafts drafts;private final Gateway gateway;
    NativeCounterCheckout(NativeDrafts drafts,Gateway gateway){this.drafts=drafts;this.gateway=gateway;}
    synchronized NativeDrafts.Draft start(String owner,long revision,String shift,String method,long received,boolean print)throws IOException{
        return start(owner,revision,shift,method,received,print,false);
    }
    synchronized NativeDrafts.Draft start(String owner,long revision,String shift,String method,long received,boolean print,boolean kitchen)throws IOException{
        if(print)NativePaidEffects.validateDraft(drafts.load(owner).lines);
        drafts.preparePayment(owner,revision,new NativeDrafts.Payment("counter-"+UUID.randomUUID(),shift,method,received,print,false,kitchen));return recover(owner,true);
    }
    synchronized NativeDrafts.Draft recover(String owner)throws IOException{
        return recover(owner,false);
    }
    private NativeDrafts.Draft recover(String owner,boolean first)throws IOException{
        NativeDrafts.Draft cart=drafts.load(owner);if(cart.payment==null)throw NativeAccess.malformed();if(cart.payment.confirmed)return cart;
        Map<String,Object> sale=gateway.read(cart.payment.id);
        if(sale.isEmpty()){
            try{gateway.send(command(owner,cart));}
            catch(NativeAccess.Failure e){
                if(first&&(e.status==400||e.status==409||e.status==413)&&gateway.read(cart.payment.id).isEmpty()){
                    drafts.rejectPayment(owner,cart.payment.id);
                    throw new IOException("Cobro rechazado y sin venta registrada. Productos conservados: revisa catálogo y turno antes de cobrar.");
                }throw e;
            }
            sale=gateway.read(cart.payment.id);
        }
        validate(owner,cart,sale);return drafts.confirmPayment(owner,cart.payment.id,false);
    }
    synchronized void finish(String owner,NativeEffects effects)throws IOException{
        NativeDrafts.Draft cart=drafts.load(owner);if(cart.payment==null||!cart.payment.confirmed)throw NativeAccess.malformed();
        Map<String,Object> sale=gateway.read(cart.payment.id);validate(owner,cart,sale);
        effects.enqueue(owner,cart.payment.id,NativePaidEffects.counter(owner,cart,sale));
        drafts.confirmPayment(owner,cart.payment.id,true);
    }
    static Map<String,Object> command(String owner,NativeDrafts.Draft cart)throws IOException{
        NativeDrafts.Payment p=cart.payment;if(p==null)throw NativeAccess.malformed();List<Object> items=new ArrayList<>();
        for(NativeSales.Line line:cart.lines)items.add(NativeAccess.map("productId",line.productId,"qty",line.qty,"unit",BigDecimal.valueOf(line.unit,2),"mods",line.mods,"note",line.note));
        return NativeAccess.map("id",p.id,"userId",owner,"shiftId",p.shift,"items",items,"total",BigDecimal.valueOf(NativeSales.total(cart.lines),2),"payment",p.method,"payWith",BigDecimal.valueOf(p.received,2),"paidAt",true,"customerName","Mostrador","channel","caja","type","pickup","needsChange",p.method.equals("Efectivo")&&p.received>NativeSales.total(cart.lines));
    }
    static void validate(String owner,NativeDrafts.Draft cart,Map<String,Object> sale)throws IOException{
        NativeDrafts.Payment p=cart.payment;if(p==null)throw NativeAccess.malformed();
        if(!p.id.equals(sale.get("id"))||!owner.equals(sale.get("userId"))||!owner.equals(sale.get("paidBy"))||!owner.equals(sale.get("invoicedBy"))||!p.shift.equals(sale.get("shiftId"))||!p.method.equals(sale.get("payment"))||!Boolean.TRUE.equals(sale.get("invoiced"))||!"pickup".equals(sale.get("type"))||!"caja".equals(sale.get("channel"))||!"Mostrador".equals(sale.get("customerName")))throw invalid();
        for(String k:new String[]{"testArchivedAt","cancelledAt","diningAccountId"})if(sale.get(k)!=null&&!"".equals(sale.get(k)))throw invalid();
        if(!Arrays.asList("nuevo","preparacion","listo","camino","entregado","facturada").contains(sale.get("status")))throw invalid();
        NativeShifts.time(NativeAccess.text(sale,"paidAt",30));NativeShifts.time(NativeAccess.text(sale,"invoicedAt",30));
        long total=NativeSales.total(cart.lines);if(NativeTables.money(sale.get("total"))!=total||NativeTables.money(sale.get("subtotal"))!=total||NativeTables.money(sale.get("payWith"))!=p.received)throw invalid();
        for(String k:new String[]{"tax","deliveryFee","tip","redeemValue"})if(NativeTables.money(sale.get(k))!=0)throw invalid();
        List<Object> expected=new ArrayList<>(),actual=new ArrayList<>();
        for(NativeSales.Line line:cart.lines)expected.add(NativeAccess.map("productId",line.productId,"name",line.name,"qty",line.qty,"unit",BigDecimal.valueOf(line.unit,2),"mods",line.mods,"note",line.note));
        Object raw=sale.get("items");if(!(raw instanceof List)||((List<?>)raw).size()!=cart.lines.size())throw invalid();
        for(Object value:(List<?>)raw){Map<String,Object> line=NativeAccess.object(value);actual.add(NativeAccess.map("productId",line.get("productId"),"name",line.get("name"),"qty",line.get("qty"),"unit",line.get("unit"),"mods",line.get("mods"),"note",line.get("note")));}
        if(!NativeReceipt.itemsFingerprint(expected).equals(NativeReceipt.itemsFingerprint(actual)))throw invalid();
    }
    private static IOException invalid(){return new IOException("Cobro de mostrador sin confirmar o discrepante. No vuelvas a cobrar; conserva la cuenta.");}
}
