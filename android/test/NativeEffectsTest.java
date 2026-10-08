package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeEffectsTest {
    static class Disk implements NativeDrafts.Store {
        byte[] bytes;boolean broken;
        public byte[] read(String owner){return bytes==null?null:bytes.clone();}
        public void write(String owner,byte[] value)throws IOException{if(broken)throw new IOException("disk");bytes=value.clone();}
    }
    public static void main(String[] args)throws Exception {
        String owner="auth-user1";Disk disk=new Disk();NativeEffects queue=new NativeEffects(disk);
        Map<String,byte[]> jobs=new LinkedHashMap<>();jobs.put("client",new byte[]{65,10});jobs.put("cut",new byte[]{29,86,0});
        queue.enqueue(owner,"pay-1",jobs);int[] sends={0};
        final NativeEffects initial=queue;
        fails(()->initial.send(owner,"pay-1","client",bytes->{sends[0]++;throw new IOException("partial");}),"partial send unknown");
        queue=new NativeEffects(disk);final NativeEffects restarted=queue;
        check(queue.state(owner,"pay-1","client")==NativeEffects.UNKNOWN,"restart retains uncertainty");
        fails(()->restarted.send(owner,"pay-1","client",bytes->sends[0]++),"never resend unknown");
        fails(()->restarted.send(owner,"pay-1","cut",bytes->sends[0]++),"cut blocked after uncertain receipt");
        queue.enqueue(owner,"pay-1",jobs);check(sends[0]==1,"handoff replay does not reset state");
        Map<String,byte[]> other=new LinkedHashMap<>();other.put("drawer",new byte[]{27,112,0,25,(byte)250});
        queue.enqueue(owner,"pay-2",other);queue.send(owner,"pay-2","drawer",bytes->sends[0]++);
        check(sends[0]==2&&queue.state(owner,"pay-2","drawer")==NativeEffects.SENT,"other paid operation proceeds");
        fails(()->restarted.send(owner,"pay-2","drawer",bytes->sends[0]++),"double tap cannot repeat pulse");
        disk.broken=true;fails(()->restarted.enqueue(owner,"pay-3",other),"disk failure preserves jobs");disk.broken=false;
        queue.enqueue(owner,"pay-3",other);disk.broken=true;
        fails(()->restarted.send(owner,"pay-3","drawer",bytes->sends[0]++),"no USB before durable marker");check(sends[0]==2,"disk failure sends nothing");disk.broken=false;
        fails(()->restarted.enqueue("auth-other","pay-3",other),"owner isolation");
        Map<String,byte[]> changed=new LinkedHashMap<>();changed.put("client",new byte[]{66});
        fails(()->restarted.enqueue(owner,"pay-1",changed),"same operation cannot change content");
        check(queue.list(owner).get("pay-1").get("client")==NativeEffects.UNKNOWN,"pending states visible without bytes");
        try{queue.list(owner).get("pay-1").put("client",0);throw new AssertionError("mutable state");}catch(UnsupportedOperationException expected){}
        queue.retireTransferred(owner,"pay-2");check(queue.list(owner).containsKey("pay-2"),"unfinished handoff protected");
        queue.retireTransferred(owner,"");check(!queue.list(owner).containsKey("pay-2"),"completed output retired after handoff");
        check(queue.list(owner).containsKey("pay-1")&&queue.list(owner).containsKey("pay-3"),"unknown and pending never pruned");
        disk.broken=true;
        fails(()->restarted.confirmPhysical(owner,"pay-1","client"),"physical confirmation must persist");disk.broken=false;
        check(queue.state(owner,"pay-1","client")==NativeEffects.UNKNOWN,"failed confirmation stays unknown");
        queue.confirmPhysical(owner,"pay-1","client");
        check(new NativeEffects(disk).state(owner,"pay-1","client")==NativeEffects.VERIFIED,"explicit physical confirmation survives restart");
        check(sends[0]==2,"physical confirmation does not touch USB");
        fails(()->restarted.confirmPhysical(owner,"pay-3","drawer"),"unattempted output cannot be marked verified");
        fails(()->restarted.send(owner,"pay-1","client",bytes->sends[0]++),"verified output is never resent");
        queue.send(owner,"pay-1","cut",bytes->sends[0]++);
        check(sends[0]==3,"confirmed paper permits pending cut once");
        queue.retireTransferred(owner,"");check(queue.list(owner).containsKey("pay-1"),"recent receipt retained for explicit copy");
        queue.copy(owner,"pay-1","copy-1");
        check(queue.list(owner).get("copy-1").keySet().equals(new LinkedHashSet<>(Arrays.asList("client","cut"))),"copy has no drawer or payment effect");
        final byte[][] copied={null};queue.send(owner,"copy-1","client",bytes->copied[0]=bytes);
        check(new String(copied[0],java.nio.charset.StandardCharsets.US_ASCII).contains("COPIA"),"copy clearly labeled");
        queue.copy(owner,"pay-1","copy-1");check(queue.state(owner,"copy-1","client")==NativeEffects.SENT,"same copy request cannot reset sent state");
        fails(()->restarted.copy(owner,"pay-3","copy-2"),"drawer is never copied");
        NativeEffects history=new NativeEffects(new Disk());byte[] large=new byte[48000];Arrays.fill(large,(byte)65);
        for(int i=0;i<12;i++){
            history.retireTransferred(owner,"");Map<String,byte[]> receipt=new LinkedHashMap<>();receipt.put("client",large);
            history.enqueue(owner,"large-"+i,receipt);history.send(owner,"large-"+i,"client",bytes->{});
        }
        check(history.list(owner).size()<12,"history bounded by bytes as well as count");
        NativeEffects full=new NativeEffects(new Disk());Map<String,byte[]> big=new LinkedHashMap<>();big.put("client",large);
        for(int i=0;i<10;i++)full.enqueue(owner,"old-"+i,big);
        fails(()->full.enqueue(owner,"current",big),"full pending queue preserves existing tickets");
        for(int i=0;i<10;i++)full.send(owner,"old-"+i,"client",bytes->{});
        full.retireTransferred(owner,new HashSet<>(Arrays.asList("current","another-payment")));
        full.enqueue(owner,"current",big);check(full.state(owner,"current","client")==NativeEffects.PENDING,"draining old tickets allows protected payment handoff");
        System.out.println("Native durable physical effects PASS");
    }
}
