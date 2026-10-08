package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeTableChangesTest {
    static Map<String,Object> transfer(){return map("action","transfer","operationId","move-1","expectedRevision",7,"accountId","a1","destinationTableId","t2");}
    static Map<String,Object> edit(){return map("action","saveTable","operationId","edit-1","expectedRevision",7,"tableId","t1","table",map("zoneId","salon","kind","table","number",31,"row",8,"column",3,"active",true,"temporary",false));}
    static final class Server implements NativeTableChanges.Gateway {
        Map<String,Object> original;boolean lose,reject;int writes;
        public Map<String,Object> send(Map<String,Object> command)throws IOException{
            if(reject)throw new NativeAccess.Failure(409,"conflict");
            if(original==null){original=command;writes++;}else check(original.equals(command),"same persisted command on replay");
            if(lose){lose=false;throw new IOException("lost");}
            Map<String,Object> result=NativeTablesTest.state("open");result.put("operationId",command.get("operationId"));return result;
        }
    }
    public static void main(String[] args)throws Exception{
        NativeDraftsTest.Disk disk=new NativeDraftsTest.Disk();Server server=new Server();server.lose=true;
        NativeTableChanges changes=new NativeTableChanges(disk,server);
        fails(()->changes.run("auth-user1",transfer()),"lost reply retained");
        check(changes.pending("auth-user1").get("accountId").equals("a1"),"same account not new account");
        fails(()->changes.run("auth-user1",edit()),"cannot replace uncertain command");
        new NativeTableChanges(disk,server).run("auth-user1",null);
        check(server.writes==1&&changes.pending("auth-user1")==null,"restart replay deduplicated and cleared");
        server=new Server();NativeTableChanges blocked=new NativeTableChanges(disk,server);disk.broken=true;
        fails(()->blocked.run("auth-user1",edit()),"disk before network");check(server.writes==0,"no write without journal");
        disk.broken=false;server.reject=true;
        fails(()->blocked.run("auth-user1",edit()),"revision rejection");check(blocked.pending("auth-user1")==null,"first definitive rejection allows explicit new attempt");
        Map<String,Object> bad=edit();NativeAccess.object(bad.get("table")).put("kind","bar");fails(()->NativeRoutes.tableChange(bad),"no bars");
        Map<String,Object> outside=edit();NativeAccess.object(outside.get("table")).put("column",5);fails(()->NativeRoutes.tableChange(outside),"position bounds");
        fails(()->NativeRoutes.tableChange(map("action","checkout")),"no payments or arbitrary actions");
        System.out.println("Native table changes contracts/durable recovery PASS");
    }
}
