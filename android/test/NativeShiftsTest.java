package hn.chingadazo.pos;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeShiftsTest {
    static java.util.Map<String,Object> shift(){return map("id","shift-1","userId","auth-user1","userName","Caja","openedAt","2026-10-03T14:00:00.000Z","closedAt","","fondo",500,"counted",0);}
    public static void main(String[] args)throws Exception{
        long now=NativeShifts.time("2026-10-03T18:00:00.000Z");
        NativeShifts.Shift s=NativeShifts.current(map("shift-1",shift()),"auth-user1",now);
        check(s!=null&&s.fund==50000,"own open shift and cents");
        check(NativeShifts.current(map("shift-1",shift()),"auth-other",now)==null,"cannot select another operator shift");
        check(NativeShifts.current(map("shift-1",shift()),"auth-user1",NativeShifts.time("2026-10-04T05:00:00.000Z"))==null,"Honduras 23 hour expiry");
        java.util.Map<String,Object> closed=shift();closed.put("closedAt","2026-10-03T17:00:00.000Z");
        check(NativeShifts.current(map("shift-1",closed),"auth-user1",now)==null,"closed cannot pay");
        java.util.Map<String,Object> second=shift();second.put("id","shift-2");
        fails(()->NativeShifts.current(map("shift-1",shift(),"shift-2",second),"auth-user1",now),"ambiguous shifts require review");
        fails(()->NativeShifts.time("2026-99-03T14:00:00.000Z"),"invalid date");
        closed.put("arqueoPending",true);closed.put("counted",null);
        check(NativeShifts.reconciliations(map("shift-1",closed),"auth-user1").size()==1,"automatic close remains available for count");
        check(NativeShifts.reconciliations(map("shift-1",closed),"auth-other").isEmpty(),"cannot reconcile another owner");
        System.out.println("Native shift owner/expiry/amounts PASS");
    }
}
