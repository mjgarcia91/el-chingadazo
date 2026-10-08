package hn.chingadazo.pos;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeTablesTest {
    static Map<String,Object> state(String status){return map("initialized",true,"revision",7,"tables",map("t1",map("id","t1","number",21,"row",6,"column",1,"active",true,"accountId","a1")),
        "accounts",map("a1",map("id","a1","tableId","t1","status",status,"orderId","sale-1","total",433,"items",Arrays.asList(map("name","Tacos","qty",1,"unit",433)))));}
    public static void main(String[] args)throws Exception{
        NativeTables open=NativeTables.parse(state("open"));
        check(open.pending("t1")==43300,"server balance is not empty cart total");
        check(!open.releasable("t1"),"unpaid cannot be released");
        NativeTables paid=NativeTables.parse(state("paid"));
        check(paid.pending("t1")==0 && paid.releasable("t1"),"paid occupied can be released");
        check(!NativeTables.parse(state("checkout")).releasable("t1"),"unknown payment cannot release");
        Map<String,Object> broken=state("paid");NativeAccess.object(NativeAccess.object(broken.get("accounts")).get("a1")).remove("orderId");
        check(!NativeTables.parse(broken).releasable("t1"),"paid needs order evidence");
        Map<String,Object> mismatch=state("paid");NativeAccess.object(NativeAccess.object(mismatch.get("accounts")).get("a1")).put("tableId","t2");
        fails(()->NativeTables.parse(mismatch),"cross-table account rejected");
        Map<String,Object> badRevision=state("paid");badRevision.put("revision",1.5);fails(()->NativeTables.parse(badRevision),"integer revision");
        Map<String,Object> noAccount=state("paid");noAccount.put("accounts",map());fails(()->NativeTables.parse(noAccount),"missing account not free");
        System.out.println("Native table balances/release eligibility PASS");
    }
}
