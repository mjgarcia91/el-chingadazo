package hn.chingadazo.pos;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeDraftContextsTest {
    public static void main(String[] args)throws Exception{
        NativeDraftsTest.Disk disk=new NativeDraftsTest.Disk();String owner="auth-user1";
        NativeSales.Line line=NativeSales.line(NativeSales.product(NativeSalesTest.product()),2,map("salsa","roja"),"Sin cebolla");
        new NativeDrafts(disk).save(owner,0,Arrays.asList(line));
        NativeDrafts counter=new NativeDrafts(new NativeDraftContexts(disk,"counter"));
        NativeDrafts mesa=new NativeDrafts(new NativeDraftContexts(disk,"account-a1"));
        check(counter.load(owner).lines.size()==1&&mesa.load(owner).lines.isEmpty(),"legacy draft belongs only to counter");
        mesa.save(owner,mesa.load(owner).revision,Arrays.asList(line));
        check(counter.load(owner).lines.size()==1,"writing table preserves old counter");
        check(NativeDraftContexts.list(disk,owner).size()==2,"all nonempty contexts recoverable");
        mesa.prepare(owner,mesa.load(owner).revision,"op-1","t1","a1",7);
        counter.save(owner,1,Collections.emptyList());
        check(mesa.load(owner).pending.operation.equals("op-1"),"other context edit retains pending command");
        check(mesa.load("auth-other").lines.isEmpty(),"operator isolation");
        disk.broken=true;fails(()->mesa.confirm(owner,"op-1"),"failed atomic context replacement");
        disk.broken=false;check(mesa.load(owner).pending!=null,"all data survives failed write");
        new NativeDrafts(new NativeDraftContexts(disk,"account-a1")).confirm(owner,"op-1");
        check(NativeDraftContexts.list(disk,owner).isEmpty(),"confirmed and empty contexts not listed");
        check(NativeDraftContexts.destination("account-a1","t2","a1"),"account follows confirmed table transfer");
        check(!NativeDraftContexts.destination("account-a1","t1","a2"),"cannot mix distinct occupations");
        check(!NativeDraftContexts.destination("table-t1","t1","a2"),"free table draft cannot silently join new occupation");
        NativeDrafts active=new NativeDrafts(new NativeDraftContexts(disk,"account-active"));
        active.save(owner,active.load(owner).revision,Arrays.asList(line));active.prepare(owner,active.load(owner).revision,"op-active","t2","active",9);
        for(int i=0;i<270;i++){NativeDrafts completed=new NativeDrafts(new NativeDraftContexts(disk,"account-done"+i));completed.save(owner,completed.load(owner).revision,Collections.emptyList());}
        check(NativeDraftContexts.list(disk,owner).equals(Arrays.asList("account-active")),"completed accounts cannot exhaust context limit or remove active account");
        check(active.load(owner).pending.operation.equals("op-active"),"cleanup preserves uncertain send");
        fails(()->counter.save(owner,2,Arrays.asList(line)),"old empty view cannot revive after context cleanup");
        fails(()->new NativeDraftContexts(disk,"../bad"),"invalid context rejected");
        disk.files.put(owner,new byte[]{0,0,0,3,1});
        fails(()->counter.save(owner,0,Arrays.asList(line)),"corrupt envelope never replaced");
        System.out.println("Native draft contexts migration/isolation/recovery PASS");
    }
}
