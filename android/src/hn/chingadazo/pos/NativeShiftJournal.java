package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import java.math.BigDecimal;

/** One durable shift operation per operator. Reconcile the exact ID before any retry. */
final class NativeShiftJournal {
    interface Gateway {Map<String,Object> read(String id)throws IOException;Map<String,Object> send(Map<String,Object> command)throws IOException;}
    private final NativeDrafts.Store store;private final Gateway gateway;
    NativeShiftJournal(NativeDrafts.Store store,Gateway gateway){this.store=store;this.gateway=gateway;}
    static Map<String,Object> command(String action,String id,long cents,String note)throws IOException{
        if(!"open".equals(action)&&!"close".equals(action))throw NativeAccess.malformed();
        NativeTables.key(NativeAccess.map("id",id),"id");
        if(cents<0||cents>100000000L||note==null||note.length()>500||("open".equals(action)&&!note.isEmpty()))throw NativeAccess.malformed();
        return Collections.unmodifiableMap(NativeAccess.map("action",action,"id",id,"amount",BigDecimal.valueOf(cents,2),"note",note));
    }
    synchronized Map<String,Object> pending(String owner)throws IOException{
        if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();
        byte[] bytes=store.read(owner);if(bytes==null)return null;
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
            if(bytes.length>4096||in.readInt()!=1)throw NativeAccess.malformed();
            Map<String,Object> result=in.readBoolean()?command(in.readUTF(),in.readUTF(),in.readLong(),in.readUTF()):null;
            if(in.read()!=-1)throw NativeAccess.malformed();return result;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void save(String owner,Map<String,Object> c)throws IOException{
        ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);out.writeInt(1);out.writeBoolean(c!=null);
        if(c!=null){out.writeUTF((String)c.get("action"));out.writeUTF((String)c.get("id"));out.writeLong(NativeTables.money(c.get("amount")));out.writeUTF((String)c.get("note"));}
        out.flush();byte[] bytes=buffer.toByteArray();try{store.write(owner,bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    synchronized NativeShifts.Shift run(String owner,Map<String,Object> proposed)throws IOException{
        Map<String,Object> c=pending(owner);boolean first=c==null;
        if(c==null){if(proposed==null||proposed.size()!=4)throw NativeAccess.malformed();c=command((String)proposed.get("action"),(String)proposed.get("id"),NativeTables.money(proposed.get("amount")),(String)proposed.get("note"));save(owner,c);}
        else if(proposed!=null)throw new IOException("Recupera primero el turno pendiente.");
        Map<String,Object> raw=gateway.read((String)c.get("id"));NativeShifts.Shift result=null;
        if(!raw.isEmpty()){result=checked(owner,c,raw);if(confirmed(c,result)){save(owner,null);return result;}}
        if("close".equals(c.get("action"))&&result==null)throw new IOException("No se encontró el turno. El intento permanece guardado.");
        Map<String,Object> reply;
        try{reply=gateway.send(c);}catch(NativeAccess.Failure e){if(first&&(e.status==400||e.status==409)){save(owner,null);throw new IOException("Turno rechazado. Actualiza y revisa los turnos antes de repetir.");}throw e;}
        result=checked(owner,c,reply);
        if(!confirmed(c,result))throw new IOException("El turno aún requiere conciliación. Recupera el intento sin cambiar sus datos.");
        save(owner,null);return result;
    }
    private static NativeShifts.Shift checked(String owner,Map<String,Object> c,Map<String,Object> raw)throws IOException{
        NativeShifts.Shift s=new NativeShifts.Shift(raw);
        if(!owner.equals(s.owner)||!c.get("id").equals(s.id))throw NativeAccess.malformed();return s;
    }
    private static boolean confirmed(Map<String,Object> c,NativeShifts.Shift s)throws IOException{
        long amount=NativeTables.money(c.get("amount"));
        if("open".equals(c.get("action"))){if(s.fund!=amount)throw new IOException("El fondo registrado no coincide; requiere revisión.");return true;}
        if(s.closedAt.isEmpty()||s.reconciliation)return false;
        if(s.counted!=amount)throw new IOException("El arqueo registrado no coincide; no se sobrescribió.");return true;
    }
}
