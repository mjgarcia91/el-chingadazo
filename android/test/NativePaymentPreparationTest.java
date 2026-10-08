package hn.chingadazo.pos;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativePaymentPreparationTest {
    public static void main(String[] args)throws Exception{
        Map<String,Object> state=NativeTablesTest.state("open"),account=NativeAccess.object(NativeAccess.object(state.get("accounts")).get("a1"));
        account.put("items",NativeReceiptTest.sale().get("items"));account.put("total",100);account.remove("orderId");
        Map<String,Object> shifts=map("shift-1",NativeShiftsTest.shift());long now=NativeShifts.time("2026-10-03T18:00:00.000Z");
        NativeCheckout.Intent intent=NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a1",7,10000,"Efectivo",15000,false,now);
        check(intent.expected.total==10000&&!intent.print&&!intent.confirmed,"validated fresh account and print choice");
        fails(()->NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a1",6,10000,"Efectivo",15000,false,now),"stale revision cannot charge");
        fails(()->NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a2",7,10000,"Efectivo",15000,false,now),"changed occupation cannot charge");
        fails(()->NativePaymentPreparation.table(state,shifts,"auth-other","t1","a1",7,10000,"Efectivo",15000,false,now),"own shift required");
        fails(()->NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a1",7,10000,"Efectivo",9999,false,now),"insufficient cash");
        account.put("status","checkout");fails(()->NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a1",7,10000,"Efectivo",15000,false,now),"existing uncertain checkout must be recovered");
        account.put("status","open");account.put("total",101);fails(()->NativePaymentPreparation.table(state,shifts,"auth-user1","t1","a1",7,10000,"Efectivo",15000,false,now),"changed price cannot charge");
        System.out.println("Native payment preparation stale state/shift/cash PASS");
    }
}
