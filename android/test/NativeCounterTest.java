package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeCounterTest {
    static class Server implements NativeCounterCheckout.Gateway {
        int writes;boolean lose;Map<String,Object> sale=map();
        public Map<String,Object> read(String id){return id.equals(sale.get("id"))?sale:map();}
        public void send(Map<String,Object> body)throws IOException{
            writes++;sale=new LinkedHashMap<>(body);sale.put("paidAt","2026-10-03T18:00:00.000Z");sale.put("invoicedAt",sale.get("paidAt"));
            sale.put("paidBy",body.get("userId"));sale.put("invoicedBy",body.get("userId"));sale.put("invoiced",true);sale.put("status","nuevo");sale.put("subtotal",body.get("total"));
            for(String k:new String[]{"tax","deliveryFee","tip","redeemValue"})sale.put(k,0);
            List<Object> items=new ArrayList<>();for(Object raw:(List<?>)body.get("items")){Map<String,Object> item=new LinkedHashMap<>(NativeAccess.object(raw));item.put("name","Tacos");items.add(item);}sale.put("items",items);
            if(lose){lose=false;throw new IOException("lost");}
        }
    }
    public static void main(String[] args)throws Exception{
        String owner="auth-user1";NativeEffectsTest.Disk disk=new NativeEffectsTest.Disk();NativeDrafts drafts=new NativeDrafts(disk);
        NativeSales.Product product=NativeSales.product(map("id","p1","name","Tacos","price",50,"category","food"));
        NativeDrafts.Draft cart=drafts.save(owner,0,Arrays.asList(NativeSales.line(product,2,map(),"")));
        Server server=new Server();NativeCounterCheckout flow=new NativeCounterCheckout(drafts,server);
        server.lose=true;final long revision=cart.revision;
        fails(()->flow.start(owner,revision,"shift-1","Efectivo",15000,false),"lost response preserves original intent");
        String id=drafts.load(owner).payment.id;
        Map<String,Object> body=NativeCounterCheckout.command(owner,drafts.load(owner));
        check(NativeRoutes.counter(body).get("id").equals(id),"fixed counter write shape");
        Map<String,Object> foreign=new LinkedHashMap<>(body);foreign.put("type","delivery");fails(()->NativeRoutes.counter(foreign),"counter cannot create delivery");
        fails(()->drafts.save(owner,drafts.load(owner).revision,Collections.emptyList()),"pending payment locks products");
        NativeDrafts.Draft paid=new NativeCounterCheckout(new NativeDrafts(disk),server).recover(owner);
        check(paid.payment.confirmed&&paid.payment.id.equals(id)&&server.writes==1,"restart confirms same sale without another PUT");
        NativeEffects effects=new NativeEffects(new NativeEffectsTest.Disk());flow.finish(owner,effects);
        check(drafts.load(owner).lines.isEmpty()&&drafts.load(owner).payment==null,"cart cleared only after durable effect handoff");
        check(effects.state(owner,id,"drawer")==NativeEffects.PENDING,"counter no-print change opens drawer");
        fails(()->effects.state(owner,id,"client"),"no print excludes receipt");
        Fake wire=NativeDiningAccessTest.wire("cashier").add(server.sale);
        client(wire,NativeDiningAccessTest.session()).counter(owner,body);
        NativeAccess.Request request=wire.requests.get(2);
        check(request.endpoint==NativeAccess.Endpoint.CREATE_ORDER&&request.bearer.equals("id-token")&&request.cookie.isEmpty(),"counter uses verified staff token only");
        check(NativeRoutes.url(request,"key").endsWith("/api/data/orders/"+id),"counter fixed order route");
        Fake wrongOwner=NativeDiningAccessTest.wire("cashier");
        fails(()->client(wrongOwner,NativeDiningAccessTest.session()).counter("auth-other",body),"counter owner mismatch");
        check(wrongOwner.requests.isEmpty(),"owner mismatch never sends credentials or payment");
        NativeEffectsTest.Disk faultDisk=new NativeEffectsTest.Disk();NativeDrafts faultDrafts=new NativeDrafts(faultDisk);
        faultDrafts.save(owner,0,Arrays.asList(NativeSales.line(product,2,map(),"")));
        Server faultServer=new Server();NativeCounterCheckout faultFlow=new NativeCounterCheckout(faultDrafts,faultServer);
        faultDisk.broken=true;
        fails(()->faultFlow.start(owner,1,"shift-1","Efectivo",10000,true),"disk fails before intent");
        check(faultServer.writes==0,"no sale without durable intent");faultDisk.broken=false;
        fails(()->faultFlow.start(owner,1,"shift-1","Efectivo",9999,true),"insufficient cash");
        check(faultDrafts.load(owner).payment==null&&faultServer.writes==0,"invalid payment leaves editable cart");
        faultServer.lose=true;fails(()->faultFlow.start(owner,1,"shift-1","Efectivo",10000,true),"unknown sale retained");
        faultServer.sale.put("total",99);
        fails(()->faultFlow.recover(owner),"wrong receipt cannot confirm");
        check(!faultDrafts.load(owner).payment.confirmed&&faultDrafts.load(owner).lines.size()==1,"discrepant receipt keeps cart");
        faultServer.sale.put("total",100);faultDisk.broken=true;
        fails(()->faultFlow.recover(owner),"confirmation disk failure");faultDisk.broken=false;
        faultFlow.recover(owner);check(faultServer.writes==1,"confirmation restart never repeats sale");
        for(String status:new String[]{"preparacion","listo","camino","entregado"}){
            faultServer.sale.put("status",status);NativeCounterCheckout.validate(owner,faultDrafts.load(owner),faultServer.sale);
        }
        faultServer.sale.put("status","cancelado");fails(()->NativeCounterCheckout.validate(owner,faultDrafts.load(owner),faultServer.sale),"cancelled receipt rejected");
        faultServer.sale.put("status","preparacion");
        NativeEffectsTest.Disk outputDisk=new NativeEffectsTest.Disk();NativeEffects output=new NativeEffects(outputDisk);outputDisk.broken=true;
        fails(()->faultFlow.finish(owner,output),"effect storage failure preserves confirmed cart");
        check(faultDrafts.load(owner).payment.confirmed,"paid state retained before effect handoff");outputDisk.broken=false;
        faultDisk.broken=true;fails(()->faultFlow.finish(owner,output),"cart clear failure after effect handoff");faultDisk.broken=false;
        String faultId=faultDrafts.load(owner).payment.id;
        output.send(owner,faultId,"client",bytes->{});
        faultFlow.finish(owner,new NativeEffects(outputDisk));
        check(output.state(owner,faultId,"client")==NativeEffects.SENT&&faultDrafts.load(owner).lines.isEmpty(),"replayed handoff never repeats sent ticket");
        NativeDrafts rejectedDrafts=new NativeDrafts(new NativeEffectsTest.Disk());rejectedDrafts.save(owner,0,Arrays.asList(NativeSales.line(product,1,map(),"")));
        Server rejecting=new Server(){public void send(Map<String,Object> body)throws IOException{throw new NativeAccess.Failure(409,"price changed");}};
        NativeCounterCheckout rejectedFlow=new NativeCounterCheckout(rejectedDrafts,rejecting);
        fails(()->rejectedFlow.start(owner,1,"shift-1","Efectivo",5000,true),"definite first rejection");
        check(rejectedDrafts.load(owner).payment==null&&rejectedDrafts.load(owner).lines.size()==1,"confirmed absence after first rejection leaves editable products");
        NativeCounterCheckout withKitchen=new NativeCounterCheckout(rejectedDrafts,new Server());
        NativeDrafts.Draft kitchenPaid=withKitchen.start(owner,rejectedDrafts.load(owner).revision,"shift-1","Efectivo",5000,true,true);
        check(kitchenPaid.payment.kitchen,"counter kitchen preference durable");
        NativeEffects kitchenOutput=new NativeEffects(new NativeEffectsTest.Disk());withKitchen.finish(owner,kitchenOutput);
        check(kitchenOutput.state(owner,kitchenPaid.payment.id,"kitchen")==NativeEffects.PENDING,"counter with print includes configured kitchen");
        char[] longLabel=new char[20000];Arrays.fill(longLabel,'x');NativeSales.Line longLine=new NativeSales.Line(product,1,5000,"",new String(longLabel),map());
        NativeDrafts largeDraft=new NativeDrafts(new NativeEffectsTest.Disk());largeDraft.save(owner,0,Arrays.asList(longLine,longLine,longLine));Server largeServer=new Server();
        fails(()->new NativeCounterCheckout(largeDraft,largeServer).start(owner,1,"shift-1","Efectivo",15000,true),"oversized receipt rejected before payment");
        check(largeServer.writes==0&&largeDraft.load(owner).payment==null,"unprintable receipt never traps a paid cart");
        System.out.println("Native counter durable payment/recovery PASS");
    }
}
