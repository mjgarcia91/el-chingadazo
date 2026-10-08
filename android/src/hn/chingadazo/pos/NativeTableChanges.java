package hn.chingadazo.pos;
import java.io.*;
import java.util.*;

/** Durable, allowlisted salon edits. Never modifies payments or deletes accounts. */
final class NativeTableChanges {
    interface Gateway {Map<String,Object> send(Map<String,Object> command)throws IOException;}
    private final NativeDrafts.Store store;private final Gateway gateway;
    NativeTableChanges(NativeDrafts.Store store,Gateway gateway){this.store=store;this.gateway=gateway;}
    synchronized Map<String,Object> pending(String owner)throws IOException{
        owner(owner);byte[] bytes=store.read(owner);if(bytes==null)return null;
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
            if(bytes.length>2048||in.readInt()!=1)throw NativeTables.invalid();Map<String,Object> command=null;
            if(in.readBoolean()){
                String action=in.readUTF(),operation=in.readUTF();long revision=in.readLong();String id=in.readUTF();
                command=NativeAccess.map("action",action,"operationId",operation,"expectedRevision",revision);
                if(action.equals("transfer")){command.put("accountId",id);command.put("destinationTableId",in.readUTF());}
                else if(action.equals("saveTable")){command.put("tableId",id);command.put("table",NativeAccess.map("zoneId","salon","kind","table","number",in.readInt(),"row",in.readInt(),"column",in.readInt(),"active",true,"temporary",false));}
                else throw NativeTables.invalid();command=NativeRoutes.tableChange(command);
            }
            if(in.read()!=-1)throw NativeTables.invalid();return command;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void save(String owner,Map<String,Object> command)throws IOException{
        ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);out.writeInt(1);out.writeBoolean(command!=null);
        if(command!=null){boolean move=command.get("action").equals("transfer");out.writeUTF((String)command.get("action"));out.writeUTF((String)command.get("operationId"));out.writeLong(((Number)command.get("expectedRevision")).longValue());
            out.writeUTF((String)command.get(move?"accountId":"tableId"));
            if(move)out.writeUTF((String)command.get("destinationTableId"));
            else{Map<String,Object> t=NativeAccess.object(command.get("table"));for(String key:new String[]{"number","row","column"})out.writeInt(((Number)t.get(key)).intValue());}}
        out.flush();byte[] bytes=buffer.toByteArray();try{store.write(owner,bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    synchronized NativeTables run(String owner,Map<String,Object> proposed)throws IOException{
        Map<String,Object> command=pending(owner);boolean first=command==null;
        if(first){if(proposed==null)throw new IOException("No hay cambio pendiente.");command=NativeRoutes.tableChange(proposed);save(owner,command);}
        else if(proposed!=null)throw new IOException("Recupera primero el cambio pendiente. No se sustituyó.");
        Map<String,Object> reply;
        try{reply=gateway.send(command);}catch(NativeAccess.Failure e){if(first&&(e.status==400||e.status==409)){save(owner,null);throw new IOException("El salón cambió o los datos fueron rechazados. Actualiza y revisa antes de repetir.");}throw e;}
        if(!command.get("operationId").equals(reply.get("operationId")))throw new IOException("Cambio sin confirmar. Conservamos el intento.");
        NativeTables state=NativeTables.parse(reply);if(!state.initialized)throw NativeTables.invalid();save(owner,null);return state;
    }
    private static void owner(String owner)throws IOException{if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeTables.invalid();}
}
