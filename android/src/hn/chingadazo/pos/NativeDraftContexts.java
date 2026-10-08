package hn.chingadazo.pos;
import java.io.*;
import java.util.*;

/** All operator contexts share the existing encrypted atomic file. Legacy data becomes counter. */
final class NativeDraftContexts implements NativeDrafts.Store {
    private static final class Records extends LinkedHashMap<String,byte[]> {long revision;}
    private final NativeDrafts.Store store;private final String context;
    NativeDraftContexts(NativeDrafts.Store store,String context)throws IOException {validate(context);this.store=store;this.context=context;}
    static void validate(String context)throws IOException {
        if(context==null||!context.matches("counter|(?:account|table)-[A-Za-z0-9_-]{1,100}"))throw new IOException("Contexto de cuenta inválido.");
    }
    static boolean destination(String context,String table,String account){return "counter".equals(context)||("account-"+account).equals(context)||account.isEmpty()&&("table-"+table).equals(context);}
    public byte[] read(String owner)throws IOException {
        synchronized(store){Records all=load(store,owner);try{byte[] value=all.get(context);return value!=null?value.clone():all.revision==0?null:NativeDrafts.encode(new NativeDrafts.Draft(all.revision,Collections.emptyList()));}finally{wipe(all);}}
    }
    public void write(String owner,byte[] bytes)throws IOException {
        synchronized(store){
            NativeDrafts.Draft next=NativeDrafts.decode(bytes);Records all=load(store,owner);
            try{
                byte[] old=all.put(context,bytes.clone());if(old!=null)Arrays.fill(old,(byte)0);
                if(all.revision==Long.MAX_VALUE)throw new IOException("Revisión de cuentas agotada.");
                all.revision=Math.max(all.revision+1,next.revision);
                // A monotonic envelope revision prevents stale writers reviving pruned empty contexts.
                Iterator<Map.Entry<String,byte[]>> iterator=all.entrySet().iterator();
                while(iterator.hasNext()){Map.Entry<String,byte[]> e=iterator.next();if(!e.getKey().equals(context)&&NativeDrafts.decode(e.getValue()).lines.isEmpty()){Arrays.fill(e.getValue(),(byte)0);iterator.remove();}}
                if(all.size()>256)throw new IOException("Demasiadas cuentas locales. No se borró ninguna.");
                ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);
                out.writeInt(4);out.writeLong(all.revision);out.writeInt(all.size());
                for(Map.Entry<String,byte[]> e:all.entrySet()){out.writeUTF(e.getKey());out.writeInt(e.getValue().length);out.write(e.getValue());}
                out.flush();byte[] encoded=buffer.toByteArray();
                try{if(encoded.length>524288)throw new IOException("El almacenamiento de cuentas está lleno. No se borró ninguna.");store.write(owner,encoded);}
                finally{Arrays.fill(encoded,(byte)0);}
            }finally{wipe(all);}
        }
    }
    static List<String> list(NativeDrafts.Store store,String owner)throws IOException {
        synchronized(store){Map<String,byte[]> all=load(store,owner);try{
            List<String> result=new ArrayList<>();for(Map.Entry<String,byte[]> e:all.entrySet())if(!NativeDrafts.decode(e.getValue()).lines.isEmpty())result.add(e.getKey());return result;
        }finally{wipe(all);}}
    }
    private static Records load(NativeDrafts.Store store,String owner)throws IOException {
        if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw new IOException("Usuario inválido.");
        byte[] bytes=store.read(owner);Records all=new Records();if(bytes==null)return all;
        try{
            if(bytes.length>524288)throw new IOException("Cuentas demasiado grandes.");
            DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));int version=in.readInt();
            if(version==1||version==2||(version>=5&&version<=8)){all.revision=NativeDrafts.decode(bytes).revision;all.put("counter",bytes.clone());return all;}
            if(version!=3&&version!=4)throw new IOException("Versión de cuentas desconocida.");
            if(version==4){all.revision=in.readLong();if(all.revision<1)throw new IOException("Revisión de cuentas inválida.");}
            int count=in.readInt();if(count<0||count>256)throw new IOException("Lista de cuentas inválida.");
            for(int i=0;i<count;i++){
                String key=in.readUTF();validate(key);int size=in.readInt();
                if(size<1||size>in.available()||all.containsKey(key))throw new IOException("Cuenta local inválida.");
                byte[] record=new byte[size];in.readFully(record);all.put(key,record);long revision=NativeDrafts.decode(record).revision;
                if(version==4&&revision>all.revision)throw new IOException("Revisión de cuenta inválida.");all.revision=Math.max(all.revision,revision);
            }
            if(in.read()!=-1)throw new IOException("Datos de cuentas adicionales.");return all;
        }catch(IOException e){wipe(all);throw e;}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static void wipe(Map<String,byte[]> records){for(byte[] bytes:records.values())Arrays.fill(bytes,(byte)0);}
}
