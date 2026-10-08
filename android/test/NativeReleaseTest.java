package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeReleaseTest {
    static class Server implements NativeRelease.Gateway {
        Map<String,Object> state=NativeTablesTest.state("paid");boolean lost;int calls;String id;
        public Map<String,Object> read(){return state;}
        public Map<String,Object> send(Map<String,Object> command)throws IOException{
            calls++;String op=(String)command.get("operationId");if(id!=null)check(id.equals(op),"same operation after lost response");id=op;
            check(command.get("action").equals("release"),"release only");
            state=map("initialized",true,"revision",8,"tables",map("t1",map("id","t1","number",21,"row",6,"column",1,"active",true,"accountId","")),"accounts",map(),"operationId",op);
            if(lost){lost=false;throw new IOException("lost");}return state;
        }
    }
    public static void main(String[] args)throws Exception{
        NativeDraftsTest.Disk disk=new NativeDraftsTest.Disk();Server s=new Server();NativeRelease r=new NativeRelease(disk,s);
        s.lost=true;fails(()->r.run("auth-user1","t1"),"lost response remains pending");
        check(r.pending("auth-user1")!=null,"persist pending before send");
        NativeRelease restarted=new NativeRelease(disk,s);check(restarted.run("auth-user1",null).account("t1")==null,"recover accepted release");
        check(restarted.pending("auth-user1")==null && s.calls==2,"clear only after confirmed");
        check(restarted.run("auth-user1","t1").account("t1")==null && s.calls==2,"already free sends nothing");
        Server unpaid=new Server();unpaid.state=NativeTablesTest.state("open");
        fails(()->new NativeRelease(new NativeDraftsTest.Disk(),unpaid).run("auth-user1","t1"),"never release unpaid");check(unpaid.calls==0,"no unpaid side effect");
        NativeDraftsTest.Disk broken=new NativeDraftsTest.Disk();broken.broken=true;Server untouched=new Server();
        fails(()->new NativeRelease(broken,untouched).run("auth-user1","t1"),"disk failure blocks network");check(untouched.calls==0,"no unjournaled mutation");
        NativeDraftsTest.Disk invalidDisk=new NativeDraftsTest.Disk();
        Server invalidReply=new Server(){public Map<String,Object> send(Map<String,Object> command){return map("operationId",command.get("operationId"),"initialized",true,"revision",8,"tables",map(),"accounts",map());}};
        NativeRelease invalidRelease=new NativeRelease(invalidDisk,invalidReply);
        fails(()->invalidRelease.run("auth-user1","t1"),"missing table is not confirmed release");
        check(invalidRelease.pending("auth-user1")!=null,"bad confirmation preserves intent");
        NativeDraftsTest.Disk finalWrite=new NativeDraftsTest.Disk();
        Server confirmed=new Server(){public Map<String,Object> send(Map<String,Object> command)throws IOException{Map<String,Object> result=super.send(command);finalWrite.broken=true;return result;}};
        NativeRelease durable=new NativeRelease(finalWrite,confirmed);
        fails(()->durable.run("auth-user1","t1"),"failure to acknowledge locally remains recoverable");
        check(durable.pending("auth-user1")!=null,"never drop intent after disk failure");
        NativeDraftsTest.Disk conflictDisk=new NativeDraftsTest.Disk();
        Server conflict=new Server(){public Map<String,Object> send(Map<String,Object> command)throws IOException{calls++;state.put("revision",8);throw new NativeAccess.Failure(409,"revision");}};
        NativeRelease conflicted=new NativeRelease(conflictDisk,conflict);
        fails(()->conflicted.run("auth-user1","t1"),"conflict requires new explicit confirmation");
        check(conflict.calls==1&&conflicted.pending("auth-user1")==null,"no automatic retry after revision rejection");
        Server changed=new Server();NativeRelease exact=new NativeRelease(new NativeDraftsTest.Disk(),changed);
        fails(()->exact.run("auth-user1","t1","previous-account"),"automatic release cannot free a later occupation");check(changed.calls==0,"changed account not released");
        System.out.println("Native release durable recovery/no unpaid mutation PASS");
    }
}
