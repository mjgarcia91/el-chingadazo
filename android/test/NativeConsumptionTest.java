package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeConsumptionTest {
    static final class Server implements NativeConsumption.Gateway {
        Map<String,Object> state=NativeTablesTest.state("open"),firstCommand;String accepted="";int writes;boolean lose,invalid,oversized,reject;
        Server(){state.put("consumptionsEnabled",true);}
        public Map<String,Object> read(){return state;}
        public void validate(Map<String,Object> command)throws IOException{if(oversized)throw new IOException("size");}
        public Map<String,Object> send(Map<String,Object> command)throws IOException{
            if(reject)throw new NativeAccess.Failure(409,"changed");
            String op=(String)command.get("operationId");
            if(accepted.isEmpty()){accepted=op;firstCommand=command;writes++;}else check(accepted.equals(op)&&firstCommand.equals(command),"same ID and exact batch after restart");
            if(lose){lose=false;throw new IOException("lost response");}
            Map<String,Object> reply=new LinkedHashMap<>(state);reply.put("operationId",invalid?"wrong":accepted);return reply;
        }
    }
    static NativeDrafts account(NativeDraftsTest.Disk disk)throws Exception{
        NativeDrafts drafts=new NativeDrafts(disk);
        drafts.save("auth-user1",0,Arrays.asList(NativeSales.line(NativeSales.product(NativeSalesTest.product()),2,map("salsa","roja"),"Sin cebolla")));return drafts;
    }
    public static void main(String[] args)throws Exception{
        NativeDraftsTest.Disk disk=new NativeDraftsTest.Disk();NativeDrafts drafts=account(disk);Server server=new Server();server.lose=true;
        fails(()->new NativeConsumption(drafts,server).run("auth-user1","t1",1,"a1"),"lost reply retains account");
        NativeDrafts.Draft pending=drafts.load("auth-user1");check(pending.lines.size()==1&&pending.pending!=null,"persist before network");
        Map<String,Object> command=NativeConsumption.command(pending);
        check(command.get("accountId").equals("a1")&&((List<?>)command.get("items")).size()==1,"only new batch and exact destination");
        server.invalid=true;
        fails(()->new NativeConsumption(new NativeDrafts(disk),server).run("auth-user1",null,0,null),"wrong receipt cannot clear");
        server.invalid=false;disk.broken=true;
        fails(()->new NativeConsumption(drafts,server).run("auth-user1",null,0,null),"failed acknowledgement disk write");
        disk.broken=false;new NativeConsumption(new NativeDrafts(disk),server).run("auth-user1",null,0,null);
        check(server.writes==1&&drafts.load("auth-user1").lines.isEmpty(),"restart replay does not duplicate and clears only confirmed batch");
        fails(()->new NativeConsumption(drafts,server).run("auth-user1","t1",1,"a1"),"second tap after success cannot send old cart");
        NativeDraftsTest.Disk fullDisk=new NativeDraftsTest.Disk();NativeDrafts full=account(fullDisk);Server size=new Server();size.oversized=true;
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"a1"),"size preflight before intent");
        check(full.load("auth-user1").pending==null&&size.writes==0,"oversize remains editable without network write");
        fullDisk.broken=true;size.oversized=false;
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"a1"),"disk failure before network");check(size.writes==0,"cannot send without durable intent");
        fullDisk.broken=false;size.state=NativeTablesTest.state("checkout");size.state.put("consumptionsEnabled",true);
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"a1"),"cannot add to account in payment");
        size.state.put("consumptionsEnabled",false);
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"a1"),"disabled server capability");
        size.state=NativeTablesTest.state("open");size.state.put("consumptionsEnabled",true);
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"old-occupation"),"changed occupation cannot receive batch");
        check(size.writes==0&&full.load("auth-user1").pending==null,"conflict retains editable draft");
        size.reject=true;
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",1,"a1"),"first request rejected by server");
        check(full.load("auth-user1").pending==null&&!full.load("auth-user1").lines.isEmpty(),"definite rejection keeps editable products");
        size.reject=false;size.lose=true;
        fails(()->new NativeConsumption(full,size).run("auth-user1","t1",full.load("auth-user1").revision,"a1"),"accepted but unknown");
        size.reject=true;
        fails(()->new NativeConsumption(full,size).run("auth-user1",null,0,null),"later conflict is not proof of no prior acceptance");
        check(full.load("auth-user1").pending!=null,"unknown prior acceptance never discarded");
        NativeDraftsTest.Disk kitchenDisk=new NativeDraftsTest.Disk();NativeDrafts kitchenDraft=account(kitchenDisk);Server kitchenServer=new Server();
        final int[] handoffs={0};
        NativeConsumption kitchen=new NativeConsumption(kitchenDraft,kitchenServer,"counter",(owner,batch)->{
            handoffs[0]++;check(batch.pending.kitchen,"kitchen preference survives durable intent");
            check(batch.pending.label.equals("21"),"comanda keeps visible table number rather than internal ID");
            if(handoffs[0]==1)throw new IOException("queue disk failed");
        });
        fails(()->kitchen.run("auth-user1","t1",1,"a1",true),"kitchen handoff before clearing confirmed batch");
        check(kitchenDraft.load("auth-user1").pending!=null,"queue failure preserves accepted batch");
        kitchen.run("auth-user1",null,0,null,false);
        check(kitchenServer.writes==1&&handoffs[0]==2&&kitchenDraft.load("auth-user1").lines.isEmpty(),"recovery preserves preference and same accepted batch");
        NativeDrafts oversized=account(new NativeDraftsTest.Disk());Server oversizedServer=new Server();
        NativeConsumption preflight=new NativeConsumption(oversized,oversizedServer,"counter",new NativeConsumption.Accepted(){
            public void validate(NativeDrafts.Draft batch)throws IOException{throw new IOException("comanda too long");}
            public void enqueue(String owner,NativeDrafts.Draft batch){throw new AssertionError("must reject before acceptance");}
        });
        fails(()->preflight.run("auth-user1","t1",1,"a1",true),"oversized comanda preflight");
        check(oversizedServer.writes==0&&oversized.load("auth-user1").pending==null,"unprintable batch remains editable before sending");
        System.out.println("Native consumption persistence/retry/confirmation PASS");
    }
}
