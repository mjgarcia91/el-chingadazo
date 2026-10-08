package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeDraftsTest {
    static final class Disk implements NativeDrafts.Store {
        final Map<String,byte[]> files=new HashMap<>(); boolean broken;
        public byte[] read(String owner) { byte[] bytes=files.get(owner);return bytes==null?null:bytes.clone(); }
        public void write(String owner,byte[] bytes) throws IOException { if(broken)throw new IOException("disk"); files.put(owner,bytes.clone()); }
    }
    public static void main(String[] args) throws Exception {
        Disk disk=new Disk(); NativeDrafts drafts=new NativeDrafts(disk);
        NativeDrafts.Draft empty=drafts.load("auth-user1");
        NativeSales.Line line=NativeSales.line(NativeSales.product(NativeSalesTest.product()),2,map("salsa","roja"),"Sin cebolla");
        NativeDrafts.Draft saved=drafts.save("auth-user1",empty.revision,Arrays.asList(line));
        check(saved.revision==1 && drafts.load("auth-user1").lines.get(0).total()==4010,"durable recovery");
        byte[] version5=NativeDrafts.encode(saved),version2=Arrays.copyOf(version5,version5.length-1),legacy=Arrays.copyOf(version5,version5.length-2);version2[3]=2;legacy[3]=1;
        check(NativeDrafts.decode(version2).lines.get(0).total()==4010,"version 2 draft remains readable");
        check(NativeDrafts.decode(legacy).lines.get(0).total()==4010,"old draft format remains readable without data loss");
        check(drafts.load("auth-other").lines.isEmpty(),"operator isolation");
        check(drafts.load("auth-user1").lines.get(0).mods.get("salsa").equals("roja"),"modifier scalar preserved");
        NativeSales.Product p=NativeSales.product(NativeSalesTest.product());
        char[] oversized=new char[20001];Arrays.fill(oversized,'x');
        NativeSales.Line invalid=new NativeSales.Line(p,1,2005,"",new String(oversized),map());
        fails(()->drafts.save("auth-user1",1,Arrays.asList(invalid)),"reject draft that cannot be decoded before disk write");
        check(drafts.load("auth-user1").revision==1,"invalid snapshot retains previous account");
        fails(()->drafts.save("auth-user1",0,Collections.emptyList()),"stale writer");
        disk.broken=true;
        fails(()->drafts.save("auth-user1",1,Collections.emptyList()),"failed storage");
        check(drafts.load("auth-user1").lines.size()==1,"failed storage retains previous account");
        disk.broken=false;
        NativeDrafts.Draft sending=drafts.prepare("auth-user1",1,"send-1","t1","a1",7);
        check(sending.pending!=null && sending.lines.size()==1,"persist command and account atomically");
        NativeDrafts restarted=new NativeDrafts(disk);
        check(restarted.load("auth-user1").pending.operation.equals("send-1"),"restart retains same operation");
        fails(()->restarted.save("auth-user1",sending.revision,Collections.emptyList()),"uncertain send locks edits");
        fails(()->restarted.confirm("auth-user1","other-send"),"wrong confirmation cannot clear account");
        disk.broken=true;
        fails(()->restarted.confirm("auth-user1","send-1"),"failed confirmation write preserves intent");
        check(restarted.load("auth-user1").pending!=null,"intent survives disk failure after acceptance");
        disk.broken=false;
        NativeDrafts.Draft confirmed=restarted.confirm("auth-user1","send-1");
        check(confirmed.lines.isEmpty() && confirmed.pending==null,"one atomic acknowledgement clears batch and intent");
        disk.broken=false; disk.files.put("auth-user1",new byte[]{1,2,3});
        fails(()->drafts.load("auth-user1"),"corrupt is not empty");
        fails(()->drafts.save("auth-user1",0,Collections.emptyList()),"never overwrite corrupt draft");
        fails(()->drafts.load("../other"),"owner key validation");
        check(disk.files.get("auth-user1").length==3,"corrupt evidence preserved");
        System.out.println("Native drafts recovery/isolation/failure PASS");
    }
}
