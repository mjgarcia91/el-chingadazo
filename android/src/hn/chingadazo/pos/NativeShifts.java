package hn.chingadazo.pos;
import java.io.IOException;
import java.text.*;
import java.util.*;

/** Server-owned shift, with the same daily 23:00 Honduras boundary as the web register. */
final class NativeShifts {
    static final class Shift {
        final String id,owner,name,openedAt,closedAt;final long fund,counted,expected;final boolean reconciliation;
        Shift(Map<String,Object> raw)throws IOException{
            id=NativeTables.key(raw,"id");owner=NativeAccess.text(raw,"userId",160);name=NativeAccess.text(raw,"userName",160);
            if(!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();
            openedAt=NativeAccess.text(raw,"openedAt",30);time(openedAt);
            Object closed=raw.get("closedAt");closedAt=closed==null||"".equals(closed)?"":NativeAccess.text(raw,"closedAt",30);if(!closedAt.isEmpty())time(closedAt);
            fund=NativeTables.money(raw.get("fondo"));counted=raw.get("counted")==null?0:NativeTables.money(raw.get("counted"));
            expected=raw.get("expected")==null?0:NativeTables.money(raw.get("expected"));reconciliation=Boolean.TRUE.equals(raw.get("arqueoPending"));
            if(raw.get("testArchivedAt")!=null&&!"".equals(raw.get("testArchivedAt")))throw new IOException("Turno archivado.");
        }
        boolean open(long now)throws IOException{
            Calendar end=Calendar.getInstance(TimeZone.getTimeZone("UTC"));long opened=time(openedAt);end.setTimeInMillis(opened);
            end.set(Calendar.HOUR_OF_DAY,5);end.set(Calendar.MINUTE,0);end.set(Calendar.SECOND,0);end.set(Calendar.MILLISECOND,0);
            if(end.getTimeInMillis()<=opened)end.add(Calendar.DAY_OF_MONTH,1);
            return closedAt.isEmpty()&&opened<=now&&now<end.getTimeInMillis();
        }
    }
    static Shift current(Map<String,Object> all,String owner,long now)throws IOException {
        if(all.size()>1024)throw NativeAccess.malformed();Shift found=null;
        for(Map.Entry<String,Object> e:all.entrySet()){
            Map<String,Object> raw=NativeAccess.object(e.getValue());if(!owner.equals(raw.get("userId")))continue;
            if(raw.get("testArchivedAt")!=null&&!"".equals(raw.get("testArchivedAt")))continue;
            Shift shift=new Shift(raw);if(!e.getKey().equals(shift.id))throw NativeAccess.malformed();
            if(shift.open(now)){if(found!=null)throw new IOException("Hay más de un turno abierto. Requiere revisión antes de cobrar.");found=shift;}
        }return found;
    }
    static long time(String value)throws IOException{
        if(value==null||!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"))throw NativeAccess.malformed();
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT);format.setLenient(false);format.setTimeZone(TimeZone.getTimeZone("UTC"));
        try{return format.parse(value).getTime();}catch(ParseException e){throw NativeAccess.malformed();}
    }
    static List<Shift> reconciliations(Map<String,Object> all,String owner)throws IOException{
        if(all.size()>1024)throw NativeAccess.malformed();List<Shift> result=new ArrayList<>();
        for(Map.Entry<String,Object> e:all.entrySet()){
            Map<String,Object> raw=NativeAccess.object(e.getValue());if(!owner.equals(raw.get("userId"))||!Boolean.TRUE.equals(raw.get("arqueoPending")))continue;
            if(raw.get("testArchivedAt")!=null&&!"".equals(raw.get("testArchivedAt")))continue;
            Shift s=new Shift(raw);if(!e.getKey().equals(s.id)||s.closedAt.isEmpty())throw NativeAccess.malformed();result.add(s);
        }
        Collections.sort(result,(a,b)->b.openedAt.compareTo(a.openedAt));return Collections.unmodifiableList(result);
    }
}
