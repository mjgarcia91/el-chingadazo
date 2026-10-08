package hn.chingadazo.pos;
import java.io.*;
import java.util.*;

/** One shared instance serializes USB work. SENT means transferred, not physically verified. */
final class NativeEffects {
    static final int PENDING=0,UNKNOWN=1,SENT=2,VERIFIED=3;
    interface Sender {void send(byte[] bytes)throws IOException;}
    private static final class Job {
        final byte[] bytes;int state;
        Job(byte[] bytes,int state){this.bytes=bytes.clone();this.state=state;}
    }
    private final NativeDrafts.Store store;
    NativeEffects(NativeDrafts.Store store){this.store=store;}
    synchronized Map<String,Map<String,Integer>> list(String owner)throws IOException{
        Map<String,Map<String,Integer>> result=new LinkedHashMap<>();
        for(Map.Entry<String,LinkedHashMap<String,Job>> e:read(owner).entrySet()){
            Map<String,Integer> states=new LinkedHashMap<>();
            for(Map.Entry<String,Job> j:e.getValue().entrySet())states.put(j.getKey(),j.getValue().state);
            result.put(e.getKey(),Collections.unmodifiableMap(states));
        }
        return Collections.unmodifiableMap(result);
    }
    synchronized void enqueue(String owner,String operation,Map<String,byte[]> effects)throws IOException{
        key(operation);if(effects==null||effects.size()>4)throw NativeAccess.malformed();
        LinkedHashMap<String,Job> next=new LinkedHashMap<>();
        for(Map.Entry<String,byte[]> e:effects.entrySet()){
            kind(e.getKey());byte[] bytes=e.getValue();if(bytes==null||bytes.length==0||bytes.length>49152)throw NativeAccess.malformed();
            next.put(e.getKey(),new Job(bytes,PENDING));
        }
        Map<String,LinkedHashMap<String,Job>> all=read(owner);Map<String,Job> old=all.get(operation);
        if(old!=null){
            if(!old.keySet().equals(next.keySet()))throw NativeAccess.malformed();
            for(String k:old.keySet())if(!Arrays.equals(old.get(k).bytes,next.get(k).bytes))throw NativeAccess.malformed();
            return;
        }
        if(all.size()>=256)throw new IOException("El diario de impresión requiere revisión. No se borraron pendientes.");
        all.put(operation,next);save(owner,all);
    }
    synchronized int state(String owner,String operation,String effect)throws IOException{return job(read(owner),operation,effect).state;}
    synchronized void copy(String owner,String operation,String copyId)throws IOException{
        key(copyId);if(!copyId.startsWith("copy-")||copyId.equals(operation))throw NativeAccess.malformed();
        Job original=job(read(owner),operation,"client");
        if(original.state==PENDING)throw new IOException("El ticket original sigue pendiente. Continúa ese envío antes de pedir una copia.");
        byte[] title="\nCOPIA - NO ES UN NUEVO COBRO\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        byte[] bytes=new byte[title.length+original.bytes.length];
        System.arraycopy(title,0,bytes,0,title.length);System.arraycopy(original.bytes,0,bytes,title.length,original.bytes.length);
        Map<String,byte[]> jobs=new LinkedHashMap<>();jobs.put("client",bytes);jobs.put("cut",new byte[]{29,86,0});enqueue(owner,copyId,jobs);
    }
    // Explicit operator observation, never a retry or a financial mutation.
    synchronized void confirmPhysical(String owner,String operation,String effect)throws IOException{
        Map<String,LinkedHashMap<String,Job>> all=read(owner);Job job=job(all,operation,effect);
        if(job.state!=UNKNOWN)throw new IOException("Solo un resultado desconocido requiere esta confirmación.");
        job.state=VERIFIED;save(owner,all);
    }
    // Caller holds the payment coordinator lock and protects its still-durable handoff.
    // Only transferred work is removed; uncertain/pending work is never age-pruned.
    synchronized void retireTransferred(String owner,String protectedOperation)throws IOException{
        retireTransferred(owner,Collections.singleton(protectedOperation));
    }
    synchronized void retireTransferred(String owner,Set<String> protectedOperations)throws IOException{
        Map<String,LinkedHashMap<String,Job>> all=read(owner);boolean changed=false;
        Set<String> recent=new HashSet<>();List<String> ids=new ArrayList<>(all.keySet());
        long retained=0;
        for(int i=ids.size()-1;i>=0&&recent.size()<20;i--){
            Map<String,Job> jobs=all.get(ids.get(i));if(!jobs.containsKey("client"))continue;
            long size=128;for(Job job:jobs.values())size+=job.bytes.length+32;
            if(retained+size<=131072){recent.add(ids.get(i));retained+=size;}
        }
        Iterator<Map.Entry<String,LinkedHashMap<String,Job>>> iterator=all.entrySet().iterator();
        while(iterator.hasNext()){
            Map.Entry<String,LinkedHashMap<String,Job>> entry=iterator.next();if(protectedOperations.contains(entry.getKey()))continue;
            boolean complete=true;for(Job job:entry.getValue().values())if(job.state!=SENT&&job.state!=VERIFIED)complete=false;
            if(complete&&!recent.contains(entry.getKey())){iterator.remove();changed=true;}
        }
        if(changed)save(owner,all);
    }
    synchronized void send(String owner,String operation,String effect,Sender sender)throws IOException{
        Map<String,LinkedHashMap<String,Job>> all=read(owner);Job job=job(all,operation,effect);
        if(job.state!=PENDING)throw new IOException("Envío ya intentado. Comprueba el resultado físico; no se repitió.");
        if("cut".equals(effect)){
            Job client=all.get(operation).get("client");
            if(client==null||(client.state!=SENT&&client.state!=VERIFIED))throw new IOException("No se confirmó el envío del ticket. No se cortó papel.");
        }
        // Persist BEFORE touching hardware; a crash or partial transfer remains UNKNOWN.
        job.state=UNKNOWN;save(owner,all);
        sender.send(job.bytes.clone());
        job.state=SENT;save(owner,all);
    }
    private static Job job(Map<String,LinkedHashMap<String,Job>> all,String op,String effect)throws IOException{
        key(op);kind(effect);Map<String,Job> jobs=all.get(op);Job job=jobs==null?null:jobs.get(effect);
        if(job==null)throw NativeAccess.malformed();return job;
    }
    private Map<String,LinkedHashMap<String,Job>> read(String owner)throws IOException{
        owner(owner);Map<String,LinkedHashMap<String,Job>> all=new LinkedHashMap<>();byte[] bytes=store.read(owner);if(bytes==null)return all;
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
            if(bytes.length>524288||in.readInt()!=1||!owner.equals(in.readUTF()))throw NativeAccess.malformed();
            int count=in.readInt();if(count<0||count>256)throw NativeAccess.malformed();
            for(int n=0;n<count;n++){
                String op=in.readUTF();key(op);int size=in.readInt();if(size<0||size>4||all.containsKey(op))throw NativeAccess.malformed();
                LinkedHashMap<String,Job> jobs=new LinkedHashMap<>();all.put(op,jobs);
                for(int j=0;j<size;j++){
                    String kind=in.readUTF();kind(kind);int state=in.readInt(),length=in.readInt();
                    if(state<0||state>3||length<1||length>49152||jobs.containsKey(kind))throw NativeAccess.malformed();
                    byte[] payload=new byte[length];in.readFully(payload);jobs.put(kind,new Job(payload,state));
                }
            }
            if(in.read()!=-1)throw NativeAccess.malformed();return all;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void save(String owner,Map<String,LinkedHashMap<String,Job>> all)throws IOException{
        ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);
        out.writeInt(1);out.writeUTF(owner);out.writeInt(all.size());
        for(Map.Entry<String,LinkedHashMap<String,Job>> entry:all.entrySet()){
            out.writeUTF(entry.getKey());out.writeInt(entry.getValue().size());
            for(Map.Entry<String,Job> e:entry.getValue().entrySet()){
                out.writeUTF(e.getKey());out.writeInt(e.getValue().state);out.writeInt(e.getValue().bytes.length);out.write(e.getValue().bytes);
            }
        }
        out.flush();byte[] bytes=buffer.toByteArray();
        try{if(bytes.length>524288)throw new IOException("Diario de impresión lleno. No se borraron pendientes.");store.write(owner,bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static void key(String s)throws IOException{if(s==null||!s.matches("[A-Za-z0-9_-]{1,80}"))throw NativeAccess.malformed();}
    private static void kind(String s)throws IOException{if(!Arrays.asList("client","cut","drawer","kitchen").contains(s))throw NativeAccess.malformed();}
    private static void owner(String s)throws IOException{if(s==null||!s.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();}
}
