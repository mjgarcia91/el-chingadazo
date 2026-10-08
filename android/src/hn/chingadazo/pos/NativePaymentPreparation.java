package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;

/** Prepare from newly fetched state, never from the empty cart or a stale tile. */
final class NativePaymentPreparation {
    static NativeCheckout.Intent table(Map<String,Object> dining,Map<String,Object> shifts,String owner,String table,String account,long revision,long total,String payment,long received,boolean print,long now)throws IOException{
        NativeTables state=NativeTables.parse(dining);NativeTables.Account a=state.account(table);
        if(!state.initialized||state.revision!=revision||a==null||!a.id.equals(account)||!a.status.equals("open")||a.total!=total||!state.tables.get(table).active)
            throw new IOException("La cuenta cambió. Actualiza y revisa el total antes de cobrar.");
        NativeShifts.Shift shift=NativeShifts.current(shifts,owner,now);
        if(shift==null)throw new IOException("Abre tu propio turno antes de cobrar.");
        Map<String,Object> raw=NativeAccess.object(NativeAccess.object(dining.get("accounts")).get(account));Object items=raw.get("items");
        String fingerprint=NativeReceipt.itemsFingerprint(items);long sum=0;
        if(print)NativePaidEffects.validateSize(items);
        for(Object item:(List<?>)items){Map<String,Object> line=NativeAccess.object(item);sum+=NativeTables.integer(line.get("qty"),1,50)*NativeTables.money(line.get("unit"));}
        if(sum!=total)throw new IOException("Los productos y el total no coinciden. No se inició el cobro.");
        NativeReceipt.Expected expected=new NativeReceipt.Expected("dining-"+account,owner,UUID.randomUUID().toString(),shift.id,account,table,total,payment,received,fingerprint);
        return new NativeCheckout.Intent(expected,revision,print,false);
    }
}
