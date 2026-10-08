package hn.chingadazo.pos;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeDiningAccessTest {
    static Memory session(){Memory m=authorized();m.saved=new NativeAccess.Saved("device-cookie",100000L,"refresh-token","user1");return m;}
    static Fake wire(String role){return new Fake().add(map("id_token","id-token","refresh_token","next-refresh","user_id","user1","expires_in","3600")).add(profile(role));}
    public static void main(String[] args)throws Exception{
        Fake f=wire("cashier").add(map("revision",4));NativeAccess a=client(f,session());
        check(a.dining("auth-user1").get("revision").equals(4),"authenticated dining read");
        NativeAccess.Request r=f.requests.get(2);
        check(r.endpoint==NativeAccess.Endpoint.DINING && r.bearer.equals("id-token") && r.cookie.isEmpty() && r.body.isEmpty(),"ID token only to fixed endpoint");
        check(NativeRoutes.url(r,"public-key").endsWith("/api/dining"),"fixed dining route");
        fails(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.DINING,map(),"",""),"key"),"no anonymous dining");
        Fake other=wire("cashier");fails(()->client(other,session()).dining("auth-other"),"owner cannot change");check(other.requests.isEmpty(),"wrong owner rejected before network");
        Fake kitchen=wire("kitchen");fails(()->client(kitchen,session()).dining("auth-user1"),"kitchen cannot read financial tables");check(kitchen.requests.size()==2,"no dining request for kitchen");
        Fake late=wire("cashier");NativeAccess canceled=client(late,session());late.during=canceled::cancel;
        fails(()->canceled.dining("auth-user1"),"canceled session cannot read tables");
        check(late.requests.size()<3,"cancel prevents dining request");
        Fake release=wire("cashier").add(map("operationId","op-1"));
        client(release,session()).release("auth-user1",map("action","release","accountId","a1","operationId","op-1","expectedRevision",7));
        check(release.requests.get(2).endpoint==NativeAccess.Endpoint.RELEASE,"explicit release endpoint");
        fails(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.RELEASE,map("action","checkout"),"id-token",""),"key"),"release cannot become payment");
        Fake noWrite=wire("cashier");fails(()->client(noWrite,session()).release("auth-user1",map("action","release")),"incomplete release rejected before auth");check(noWrite.requests.isEmpty(),"invalid release has no effect");
        java.util.Map<String,Object> batch=map("action","consume","operationId","op-2","expectedRevision",7,"tableId","t1","accountId","a1",
            "items",java.util.Arrays.asList(map("productId","p1","qty",1,"unit",20.05,"mods",map(),"note","Sin cebolla")));
        Fake consume=wire("cashier").add(map("operationId","op-2"));client(consume,session()).consume("auth-user1",batch);
        check(consume.requests.get(2).endpoint==NativeAccess.Endpoint.CONSUME,"separate allowlisted consumption endpoint");
        check(NativeRoutes.url(consume.requests.get(2),"key").endsWith("/api/dining"),"fixed consumption route");
        batch.put("payment","cash");Fake invalid=wire("cashier");
        fails(()->client(invalid,session()).consume("auth-user1",batch),"consumption cannot smuggle payment");check(invalid.requests.isEmpty(),"invalid consumption rejected before network");
        batch.remove("payment");java.util.Map<String,Object> line=NativeAccess.object(((java.util.List<?>)batch.get("items")).get(0));
        line.put("qty",1.5);fails(()->NativeRoutes.consume(batch),"fractional quantity");line.put("qty",1);
        line.put("unit",Double.NaN);fails(()->NativeRoutes.consume(batch),"nonfinite price");line.put("unit",20.05);
        line.put("mods",map("salsa",java.util.Arrays.asList("roja","roja")));fails(()->NativeRoutes.consume(batch),"duplicate modifiers");
        line.put("mods",map("salsa",java.util.Arrays.asList("roja")));
        java.util.Map<String,Object> frozen=NativeRoutes.consume(batch);line.put("note","changed");
        check(NativeAccess.object(((java.util.List<?>)frozen.get("items")).get(0)).get("note").equals("Sin cebolla"),"snapshot detached from caller mutation");
        java.util.Map<String,Object> edit=map("action","saveTable","operationId","edit-1","expectedRevision",7,"tableId","t1","table",map("zoneId","salon","kind","table","number",31,"row",8,"column",3,"active",true,"temporary",false));
        Fake denied=wire("cashier");fails(()->client(denied,session()).tableChange("auth-user1",edit),"cashier cannot edit layout");check(denied.requests.size()==2,"no mutation after role rejection");
        Fake admin=wire("admin").add(map("operationId","edit-1"));client(admin,session()).tableChange("auth-user1",edit);
        check(NativeRoutes.url(admin.requests.get(2),"key").endsWith("/api/dining"),"fixed table edit endpoint");
        System.out.println("Native dining identity/routes/cancellation PASS");
        Fake shifts=wire("cashier").add(map());client(shifts,session()).shifts("auth-user1");
        check(NativeRoutes.url(shifts.requests.get(2),"key").endsWith("/api/data/shifts"),"authenticated fixed shifts");
        fails(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.SHIFT,map("id","../orders"),"id-token",""),"key"),"no shift path traversal");
        fails(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.SHIFTS,map(),"",""),"key"),"no public shift access");
        Fake open=wire("cashier").add(map("id","shift-1"));client(open,session()).changeShift("auth-user1","Caja",map("action","open","id","shift-1","amount",500,"note",""));
        check(open.requests.get(2).endpoint==NativeAccess.Endpoint.OPEN_SHIFT&&open.requests.get(2).body.get("userId").equals("auth-user1"),"shift owner bound to verified session");
        Fake order=wire("cashier").add(map());client(order,session()).order("auth-user1","dining-a1");
        check(NativeRoutes.url(order.requests.get(2),"key").endsWith("/api/data/orders/dining-a1"),"read exact order for reconciliation");
        java.util.Map<String,Object> payment=map("action","checkout","accountId","a1","operationId","pay-1","expectedRevision",7,"shiftId","s1","payment","Efectivo","payWith",500);
        Fake checkout=wire("cashier").add(map());client(checkout,session()).checkout("auth-user1",payment);
        check(NativeRoutes.url(checkout.requests.get(2),"key").endsWith("/api/dining"),"checkout uses existing fixed contract");
        payment.put("payWith",-1);Fake badPayment=wire("cashier");fails(()->client(badPayment,session()).checkout("auth-user1",payment),"reject invalid money before request");check(badPayment.requests.isEmpty(),"invalid payment never leaves device");
    }
}
