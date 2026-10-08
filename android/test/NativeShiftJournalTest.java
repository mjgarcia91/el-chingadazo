package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeShiftJournalTest {
    static final String OWNER="auth-user1";
    static class Disk implements NativeDrafts.Store {byte[] bytes;boolean broken;public byte[] read(String o){return bytes==null?null:bytes.clone();}public void write(String o,byte[] b)throws IOException{if(broken)throw new IOException("disk");bytes=b.clone();}}
    static class Server implements NativeShiftJournal.Gateway {
        Map<String,Object> record;int opens,closes;boolean lose;
        public Map<String,Object> read(String id){return record==null?map():new LinkedHashMap<>(record);}
        public Map<String,Object> send(Map<String,Object> c)throws IOException{
            if(c.get("action").equals("open")){opens++;record=NativeShiftsTest.shift();record.put("id",c.get("id"));record.put("fondo",c.get("amount"));}
            else {closes++;record.put("closedAt","2026-10-03T18:00:00.000Z");record.put("counted",c.get("amount"));record.put("arqueoPending",false);}
            if(lose){lose=false;throw new IOException("lost response");}return new LinkedHashMap<>(record);
        }
    }
    public static void main(String[] args)throws Exception{
        Disk disk=new Disk();Server server=new Server();NativeShiftJournal j=new NativeShiftJournal(disk,server);
        Map<String,Object> open=NativeShiftJournal.command("open","shift-1",50000,"");server.lose=true;
        fails(()->j.run(OWNER,open),"lost response remains pending");check(j.pending(OWNER)!=null,"durable intent");
        NativeShifts.Shift s=new NativeShiftJournal(disk,server).run(OWNER,null);check(s.fund==50000&&server.opens==1,"read reconciles without duplicate open");
        server.lose=true;fails(()->j.run(OWNER,NativeShiftJournal.command("close","shift-1",62000,"Cierre")),"close response lost");
        j.run(OWNER,null);check(server.closes==1&&j.pending(OWNER)==null,"recovery never repeats confirmed close");
        disk.broken=true;fails(()->j.run(OWNER,open),"disk failure prevents write");check(server.opens==1,"no open without durable journal");disk.broken=false;
        server.record=NativeShiftsTest.shift();server.record.put("userId","auth-other");fails(()->j.run(OWNER,open),"foreign shift blocked");check(j.pending(OWNER)!=null,"mismatch retained");
        fails(()->j.run(OWNER,open),"cannot replace pending intent");
        fails(()->NativeShiftJournal.command("delete","shift-1",0,""),"no arbitrary actions");
        fails(()->NativeShiftJournal.command("open","../bad",0,""),"no arbitrary paths");
        fails(()->NativeShiftJournal.command("open","shift-1",-1,""),"negative amount");
        Disk rejectedDisk=new Disk();Server rejected=new Server(){public Map<String,Object> send(Map<String,Object> c)throws IOException{throw new NativeAccess.Failure(409,"conflict");}};
        NativeShiftJournal rejectedJournal=new NativeShiftJournal(rejectedDisk,rejected);fails(()->rejectedJournal.run(OWNER,open),"definite opening conflict");check(rejectedJournal.pending(OWNER)==null,"fresh definite rejection permits corrected operation");
        Disk autoDisk=new Disk();Server auto=new Server();auto.record=NativeShiftsTest.shift();auto.record.put("closedAt","2026-10-04T05:00:00.000Z");auto.record.put("arqueoPending",true);auto.record.put("counted",null);
        check(new NativeShiftJournal(autoDisk,auto).run(OWNER,NativeShiftJournal.command("close","shift-1",62000,"Arqueo")).counted==62000&&auto.closes==1,"automatic close can reconcile its count");
        System.out.println("Native shift durable recovery PASS");
    }
}
