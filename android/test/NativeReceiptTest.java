package hn.chingadazo.pos;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeReceiptTest {
    static Map<String,Object> sale(){return map("id","dining-a1","userId","auth-user1","paidBy","auth-user1","invoicedBy","auth-user1","revision","pay-1","shiftId","shift-1","diningAccountId","a1","tableId","t1","status","facturada","invoiced",true,"paidAt","2026-10-03T18:00:00.000Z","invoicedAt","2026-10-03T18:00:00.000Z","total",100,"subtotal",100,"tax",0,"deliveryFee",0,"tip",0,"redeemValue",0,"payment","Efectivo","payWith",150,"changeGiven",50,"items",Arrays.asList(map("productId","p1","name","Tacos","qty",2,"unit",50,"mods",map(),"note","")));}
    public static void main(String[] args)throws Exception{
        Map<String,Object> sale=sale();String items=NativeReceipt.itemsFingerprint(sale.get("items"));
        NativeReceipt.Expected expected=new NativeReceipt.Expected("dining-a1","auth-user1","pay-1","shift-1","a1","t1",10000,"Efectivo",15000,items);
        NativeReceipt.validate(expected,sale);
        sale.put("total",99);fails(()->NativeReceipt.validate(expected,sale),"wrong total never confirms");sale.put("total",100);
        sale.put("paidBy","auth-other");fails(()->NativeReceipt.validate(expected,sale),"wrong operator never confirms");sale.put("paidBy","auth-user1");
        sale.put("cancelledAt","2026-10-03T19:00:00.000Z");fails(()->NativeReceipt.validate(expected,sale),"canceled receipt");sale.remove("cancelledAt");
        sale.put("changeGiven",0);fails(()->NativeReceipt.validate(expected,sale),"wrong change");sale.put("changeGiven",50);
        Map<String,Object> line=NativeAccess.object(((List<?>)sale.get("items")).get(0));line.put("note","Sin cebolla");fails(()->NativeReceipt.validate(expected,sale),"different contents");line.put("note","");
        line.put("unit",50.0);check(items.equals(NativeReceipt.itemsFingerprint(sale.get("items"))),"numeric representation normalized");
        sale.remove("paidAt");fails(()->NativeReceipt.validate(expected,sale),"HTTP200 alone is insufficient");
        System.out.println("Native receipt identity/content/payment confirmation PASS");
    }
}
