package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeCheckoutTest {
    static class Server implements NativeCheckout.Gateway {
        int sends;boolean lose;Map<String,Object> sale;
        public Map<String,Object> order(String id){return sale==null?map():sale;}
        public void send(Map<String,Object> c)throws IOException{ sends++;sale=NativeReceiptTest.sale();sale.put("revision",c.get("operationId"));if(lose){lose=false;throw new IOException("lost");}}
    }
    public static void main(String[] args)throws Exception{
        NativeShiftJournalTest.Disk disk=new NativeShiftJournalTest.Disk();Server server=new Server();NativeCheckout checkout=new NativeCheckout(disk,server);
        NativeReceipt.Expected expected=new NativeReceipt.Expected("dining-a1","auth-user1","pay-1","shift-1","a1","t1",10000,"Efectivo",15000,NativeReceipt.itemsFingerprint(NativeReceiptTest.sale().get("items")));
        NativeCheckout.Intent proposed=new NativeCheckout.Intent(expected,8,false,false);server.lose=true;
        fails(()->checkout.run("auth-user1",proposed),"unknown send stays pending");check(checkout.pending("auth-user1")!=null,"journal persisted");
        NativeCheckout.Intent done=new NativeCheckout(disk,server).run("auth-user1",null);
        check(done.confirmed&&!done.print&&server.sends==1,"recover receipt without duplicate payment or changed print choice");
        checkout.run("auth-user1",null);check(server.sends==1,"confirmed receipt never resends payment");
        fails(()->checkout.run("auth-user1",proposed),"new payment cannot replace pending effects");
        fails(()->checkout.run("auth-other",null),"owner mismatch");
        NativeShiftJournalTest.Disk broken=new NativeShiftJournalTest.Disk();broken.broken=true;Server noSend=new Server();
        fails(()->new NativeCheckout(broken,noSend).run("auth-user1",proposed),"disk failure before payment");check(noSend.sends==0,"no payment without durable record");
        NativeShiftJournalTest.Disk after=new NativeShiftJournalTest.Disk();Server paidBeforeDisk=new Server(){public void send(Map<String,Object> c)throws IOException{super.send(c);after.broken=true;}};
        NativeCheckout recovery=new NativeCheckout(after,paidBeforeDisk);fails(()->recovery.run("auth-user1",proposed),"disk failure after payment");after.broken=false;
        check(recovery.run("auth-user1",null).confirmed&&paidBeforeDisk.sends==1,"disk recovery reads sale without charging again");
        NativeShiftJournalTest.Disk mismatchDisk=new NativeShiftJournalTest.Disk();Server mismatch=new Server();mismatch.sale=NativeReceiptTest.sale();mismatch.sale.put("total",200);
        NativeCheckout wrong=new NativeCheckout(mismatchDisk,mismatch);fails(()->wrong.run("auth-user1",proposed),"existing discrepant sale is not overwritten");check(mismatch.sends==0&&!wrong.pending("auth-user1").confirmed,"mismatch blocks payment and confirmation");
        NativeEffectsTest.Disk effectsDisk=new NativeEffectsTest.Disk();NativeEffects effects=new NativeEffects(effectsDisk);
        effectsDisk.broken=true;fails(()->checkout.finish("auth-user1",effects),"handoff failure retains payment");
        check(checkout.pending("auth-user1").confirmed,"confirmed payment retained until queue durable");effectsDisk.broken=false;
        disk.broken=true;fails(()->checkout.finish("auth-user1",effects),"clear failure after enqueue");disk.broken=false;
        check(effects.state("auth-user1","pay-1","drawer")==NativeEffects.PENDING,"no print still queues change drawer");
        checkout.finish("auth-user1",effects);check(checkout.pending("auth-user1")==null&&server.sends==1,"durable handoff clears without recharging");
        fails(()->effects.state("auth-user1","pay-1","client"),"no print means no receipt");
        fails(()->effects.state("auth-user1","pay-1","cut"),"no print means no cut");
        Map<String,byte[]> printed=NativePaidEffects.create(new NativeCheckout.Intent(expected,8,true,true),server.sale);
        check(printed.size()==3&&printed.get("cut").length==3,"receipt cut and change are separate effects");
        byte[] body=printed.get("client");check(body[body.length-1]==10,"receipt bytes exclude cut");
        String ticket=new String(body,"US-ASCII");check(ticket.contains("TOTAL L. 100.00")&&ticket.contains("CAMBIO L. 50.00"),"ticket matches confirmed totals");
        NativeReceipt.Expected card=new NativeReceipt.Expected("dining-a1","auth-user1","pay-1","shift-1","a1","t1",10000,"Tarjeta",0,expected.items);
        Map<String,Object> cardSale=NativeReceiptTest.sale();cardSale.put("payment","Tarjeta");cardSale.put("payWith",0);cardSale.put("changeGiven",0);
        check(NativePaidEffects.create(new NativeCheckout.Intent(card,8,false,true),cardSale).isEmpty(),"card without print has no physical effects");
        NativeDrafts.Draft batch=new NativeDrafts.Draft(1,Arrays.asList(NativeSales.line(NativeSales.product(NativeSalesTest.product()),2,NativeAccessTest.map("salsa","roja"),"Sin cebolla\u001b")),new NativeDrafts.Pending("batch-1","t1","a1",1,true));
        Map<String,byte[]> kitchen=NativePaidEffects.kitchen(batch);
        check(kitchen.size()==1&&kitchen.containsKey("kitchen"),"comanda has no customer receipt or drawer");
        String comanda=new String(kitchen.get("kitchen"),"US-ASCII");
        check(comanda.contains("COCINA")&&comanda.contains("NO ES COMPROBANTE DE PAGO")&&comanda.contains("batch-1"),"comanda identifies batch and is not a receipt");
        System.out.println("Native table checkout journal/reconciliation PASS");
    }
}
