package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativePaymentServiceTest {
    static class Server implements NativeAccess.Wire {
        int charges,releases;boolean lost;Map<String,Object> sale;
        Map<String,Object> state=NativeTablesTest.state("open");
        Server()throws IOException{Map<String,Object> a=NativeAccess.object(NativeAccess.object(state.get("accounts")).get("a1"));a.put("total",100);a.put("items",NativeReceiptTest.sale().get("items"));a.remove("orderId");}
        public NativeAccess.Reply send(NativeAccess.Request r)throws IOException{
            NativeRoutes.url(r,"key");Map<String,Object> body;
            switch(r.endpoint){
                case REFRESH:body=map("id_token","id-token","refresh_token","next-refresh","user_id","user1","expires_in","3600");break;
                case ME:body=profile("cashier");break;
                case DINING:body=state;break;
                case SHIFTS:body=map("shift-1",NativeShiftsTest.shift());break;
                case ORDER:body=sale==null?map():sale;break;
                case CHECKOUT:
                    charges++;sale=NativeReceiptTest.sale();sale.put("revision",r.body.get("operationId"));
                    Map<String,Object> a=NativeAccess.object(NativeAccess.object(state.get("accounts")).get("a1"));a.put("status","paid");a.put("orderId","dining-a1");state.put("revision",8);
                    if(lost){lost=false;throw new IOException("lost");}body=state;break;
                case RELEASE:
                    releases++;state.put("accounts",map());NativeAccess.object(NativeAccess.object(state.get("tables")).get("t1")).put("accountId","");state.put("operationId",r.body.get("operationId"));body=state;break;
                default:throw new IOException("unexpected endpoint");
            }return new NativeAccess.Reply(200,body,"");
        }
    }
    public static void main(String[] args)throws Exception{
        Server server=new Server();NativeAccess access=new NativeAccess(server,NativeDiningAccessTest.session(),()->1000L);
        NativeDraftsTest.Disk payments=new NativeDraftsTest.Disk(),releases=new NativeDraftsTest.Disk();
        NativePaymentService service=new NativePaymentService(access,"auth-user1",payments,releases,()->NativeShifts.time("2026-10-03T18:00:00.000Z"));
        server.lost=true;fails(()->service.table("t1","a1",7,10000,"Efectivo",15000,false),"payment response lost");
        fails(service::releaseConfirmed,"unknown payment cannot release");check(server.releases==0,"no premature release");
        check(service.recover().confirmed&&server.charges==1,"recover same receipt through authenticated transport");
        check(service.releaseConfirmed().account("t1")==null&&server.releases==1,"same paid account released");
        service.recover();check(server.charges==1,"physical followup cannot duplicate charge");
        Map<String,Object> next=NativeTablesTest.state("open");
        Map<String,Object> nextAccount=NativeAccess.object(NativeAccess.object(next.get("accounts")).get("a1"));nextAccount.put("id","a2");
        next.put("accounts",map("a2",nextAccount));NativeAccess.object(NativeAccess.object(next.get("tables")).get("t1")).put("accountId","a2");server.state=next;
        NativeEffects effects=new NativeEffects(new NativeEffectsTest.Disk());service.finish(effects);
        check(service.pending()==null&&server.charges==1&&server.releases==1,"handoff after table reused never releases new account");
        System.out.println("Native payment service auth/recovery/paid release PASS");
    }
}
