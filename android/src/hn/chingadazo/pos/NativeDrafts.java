package hn.chingadazo.pos;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;

/** Durable local draft; never a sale or a server-confirmed balance. */
final class NativeDrafts {
    interface Store { byte[] read(String owner) throws IOException; void write(String owner,byte[] bytes) throws IOException; }
    static final class Pending {
        final String operation,table,account,label;final long revision;final boolean kitchen;
        Pending(String operation,String table,String account,long revision)throws IOException {
            this(operation,table,account,revision,false);
        }
        Pending(String operation,String table,String account,long revision,boolean kitchen)throws IOException {
            this(operation,table,account,revision,kitchen,table);
        }
        Pending(String operation,String table,String account,long revision,boolean kitchen,String label)throws IOException {
            if(!key(operation,80)||!key(table,100)||account==null||(!account.isEmpty()&&!key(account,100))||revision<0||revision>9007199254740991L)throw new IOException("Destino de envío inválido.");
            if(!key(label,100))throw new IOException("Etiqueta de mesa inválida.");
            this.operation=operation;this.table=table;this.account=account;this.revision=revision;this.kitchen=kitchen;this.label=label;
        }
        private static boolean key(String s,int max){return s!=null&&s.matches("[A-Za-z0-9_-]{1,"+max+"}")&&!Arrays.asList("__proto__","constructor","prototype").contains(s);}
    }
    static final class Draft {
        final long revision; final List<NativeSales.Line> lines;final Pending pending;final Payment payment;
        Draft(long revision,List<NativeSales.Line> lines) {this(revision,lines,null);}
        Draft(long revision,List<NativeSales.Line> lines,Pending pending) {this(revision,lines,pending,null);}
        Draft(long revision,List<NativeSales.Line> lines,Pending pending,Payment payment) { this.revision=revision;this.lines=Collections.unmodifiableList(new ArrayList<>(lines));this.pending=pending;this.payment=payment; }
    }
    static final class Payment {
        final String id,shift,method;final long received;final boolean print,confirmed,kitchen;
        Payment(String id,String shift,String method,long received,boolean print,boolean confirmed)throws IOException{
            this(id,shift,method,received,print,confirmed,false);
        }
        Payment(String id,String shift,String method,long received,boolean print,boolean confirmed,boolean kitchen)throws IOException{
            if(id==null||!id.matches("counter-[A-Za-z0-9_-]{1,60}")||!Pending.key(shift,100)||!Arrays.asList("Efectivo","Tarjeta","Transferencia").contains(method)||received<0||received>10000000000L||(!method.equals("Efectivo")&&received!=0))throw new IOException("Intento de cobro inválido.");
            this.id=id;this.shift=shift;this.method=method;this.received=received;this.print=print;this.confirmed=confirmed;this.kitchen=kitchen;
        }
    }
    private final Store store;
    NativeDrafts(Store store) { this.store=store; }
    private void owner(String owner) throws IOException { if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw new IOException("Usuario de borrador inválido."); }
    synchronized Draft load(String owner) throws IOException {
        owner(owner); byte[] bytes=store.read(owner); if(bytes==null)return new Draft(0,Collections.emptyList());
        try { return decode(bytes); } finally { Arrays.fill(bytes,(byte)0); }
    }
    synchronized Draft save(String owner,long expected,List<NativeSales.Line> lines) throws IOException {
        Draft current=load(owner);
        if(current.payment!=null||current.pending!=null||current.revision!=expected || expected==Long.MAX_VALUE || lines==null || lines.size()>50)throw new IOException("La cuenta cambió o tiene un envío pendiente. Vuelve a abrirla.");
        return write(owner,new Draft(expected+1,lines));
    }
    synchronized Draft prepare(String owner,long expected,String operation,String table,String account,long revision)throws IOException {
        return prepare(owner,expected,operation,table,account,revision,false);
    }
    synchronized Draft prepare(String owner,long expected,String operation,String table,String account,long revision,boolean kitchen)throws IOException {
        return prepare(owner,expected,operation,table,account,revision,kitchen,table);
    }
    synchronized Draft prepare(String owner,long expected,String operation,String table,String account,long revision,boolean kitchen,String label)throws IOException {
        Draft current=load(owner);
        if(current.payment!=null||current.pending!=null||current.revision!=expected||expected==Long.MAX_VALUE||current.lines.isEmpty())throw new IOException("La cuenta cambió o tiene un envío pendiente.");
        return write(owner,new Draft(expected+1,current.lines,new Pending(operation,table,account,revision,kitchen,label)));
    }
    synchronized Draft confirm(String owner,String operation)throws IOException {
        return finishSend(owner,operation,true);
    }
    synchronized Draft reject(String owner,String operation)throws IOException {
        return finishSend(owner,operation,false);
    }
    synchronized Draft preparePayment(String owner,long revision,Payment payment)throws IOException{
        Draft current=load(owner);long total=NativeSales.total(current.lines);
        if(current.revision!=revision||revision==Long.MAX_VALUE||current.pending!=null||current.payment!=null||payment==null||payment.confirmed||total<=0||total>10000000000L||(payment.method.equals("Efectivo")&&payment.received<total))throw new IOException("Cuenta cambiada, vacía o efectivo insuficiente.");
        return write(owner,new Draft(revision+1,current.lines,null,payment));
    }
    synchronized Draft confirmPayment(String owner,String id,boolean clear)throws IOException{
        Draft current=load(owner);Payment p=current.payment;
        if(p==null||!p.id.equals(id)||current.revision==Long.MAX_VALUE||clear&&!p.confirmed)throw new IOException("Cobro no confirmado. No se borró la cuenta.");
        return write(owner,new Draft(current.revision+1,clear?Collections.emptyList():current.lines,null,clear?null:new Payment(p.id,p.shift,p.method,p.received,p.print,true,p.kitchen)));
    }
    synchronized void rejectPayment(String owner,String id)throws IOException{
        Draft current=load(owner);if(current.payment==null||current.payment.confirmed||!current.payment.id.equals(id)||current.revision==Long.MAX_VALUE)throw NativeAccess.malformed();
        write(owner,new Draft(current.revision+1,current.lines));
    }
    private Draft finishSend(String owner,String operation,boolean accepted)throws IOException {
        Draft current=load(owner);
        if(current.pending==null||!current.pending.operation.equals(operation)||current.revision==Long.MAX_VALUE)throw new IOException("Confirmación de envío no válida. Conservamos la cuenta.");
        return write(owner,new Draft(current.revision+1,accepted?Collections.emptyList():current.lines));
    }
    private Draft write(String owner,Draft next)throws IOException {
        byte[] bytes=encode(next);
        // Never replace the previous durable account with a snapshot we cannot recover.
        try { decode(bytes); store.write(owner,bytes); return next; } finally { Arrays.fill(bytes,(byte)0); }
    }
    static byte[] encode(Draft draft) throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream(); DataOutputStream out=new DataOutputStream(bytes);
        out.writeInt(8); out.writeLong(draft.revision); out.writeInt(draft.lines.size());
        for(NativeSales.Line line:draft.lines) {
            if(line==null)throw new IOException("Línea inválida; no se guardó la cuenta.");
            out.writeUTF(line.productId);out.writeUTF(line.name);out.writeInt(line.qty);out.writeLong(line.unit);
            out.writeUTF(line.note);out.writeUTF(line.modsText);out.writeInt(line.mods.size());
            for(Map.Entry<String,Object> item:line.mods.entrySet()) {
                out.writeUTF(item.getKey()); boolean scalar=item.getValue() instanceof String;out.writeBoolean(scalar);
                List<?> ids=scalar?Arrays.asList(item.getValue()):NativeSales.array(item.getValue(),100);
                out.writeInt(ids.size());for(Object id:ids)out.writeUTF((String)id);
            }
        }
        out.writeBoolean(draft.pending!=null);
        if(draft.pending!=null){out.writeUTF(draft.pending.operation);out.writeUTF(draft.pending.table);out.writeUTF(draft.pending.account);out.writeLong(draft.pending.revision);out.writeBoolean(draft.pending.kitchen);out.writeUTF(draft.pending.label);}
        out.writeBoolean(draft.payment!=null);
        if(draft.payment!=null){Payment p=draft.payment;out.writeUTF(p.id);out.writeUTF(p.shift);out.writeUTF(p.method);out.writeLong(p.received);out.writeBoolean(p.print);out.writeBoolean(p.confirmed);out.writeBoolean(p.kitchen);}
        out.flush(); byte[] result=bytes.toByteArray();
        if(result.length>524288)throw new IOException("Cuenta demasiado grande; no se guardó.");return result;
    }
    static Draft decode(byte[] bytes) throws IOException {
        if(bytes.length>524288)throw new IOException("Borrador demasiado grande.");
        try {
            DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));
            int version=in.readInt();if(version!=1&&version!=2&&(version<5||version>8))throw new IOException("Versión de borrador desconocida.");
            long revision=in.readLong(); if(revision<1)throw new IOException("Revisión inválida.");
            int count=count(in,50);List<NativeSales.Line> lines=new ArrayList<>();
            for(int n=0;n<count;n++) {
                String id=in.readUTF(),name=in.readUTF();int qty=in.readInt();long unit=in.readLong();
                String note=in.readUTF(),label=in.readUTF();int groups=count(in,30);Map<String,Object> mods=new LinkedHashMap<>();
                if(qty<1||qty>50||unit<0||unit>100000000L||note.length()>500||label.length()>20000)throw new IOException("Línea inválida.");
                for(int g=0;g<groups;g++) {
                    String key=in.readUTF();boolean scalar=in.readBoolean();int size=count(in,100);
                    if(!key.matches("[A-Za-z0-9_-]{1,150}")||mods.containsKey(key)||scalar&&size!=1)throw new IOException("Opciones inválidas.");
                    List<String> ids=new ArrayList<>();Set<String> unique=new HashSet<>();
                    for(int i=0;i<size;i++){String value=in.readUTF();if(!value.matches("[A-Za-z0-9_-]{1,150}")||!unique.add(value))throw new IOException("Opción inválida.");ids.add(value);}
                    mods.put(key,scalar?ids.get(0):Collections.unmodifiableList(ids));
                }
                NativeSales.Product snapshot=NativeSales.product(NativeAccess.map("id",id,"name",name,"category","saved","price",BigDecimal.valueOf(unit,2)));
                lines.add(new NativeSales.Line(snapshot,qty,unit,note,label,mods));
            }
            Pending pending=null;
            if(version>=2&&in.readBoolean()){
                String op=in.readUTF(),table=in.readUTF(),account=in.readUTF();long rev=in.readLong();boolean kitchen=version>=6&&in.readBoolean();
                pending=new Pending(op,table,account,rev,kitchen,version>=8?in.readUTF():table);
            }
            Payment payment=null;if(version>=5&&in.readBoolean())payment=new Payment(in.readUTF(),in.readUTF(),in.readUTF(),in.readLong(),in.readBoolean(),in.readBoolean(),version>=7&&in.readBoolean());
            if(payment!=null&&(pending!=null||lines.isEmpty()||NativeSales.total(lines)<=0||payment.method.equals("Efectivo")&&payment.received<NativeSales.total(lines)))throw new IOException("Cobro local inválido.");
            if(pending!=null&&lines.isEmpty())throw new IOException("Envío vacío inválido.");
            if(in.read()!=-1)throw new IOException("Datos adicionales inválidos.");
            return new Draft(revision,lines,pending,payment);
        } catch(EOFException|IllegalArgumentException e) { throw new IOException("No se pudo leer el borrador. No borres datos."); }
    }
    private static int count(DataInputStream in,int max) throws IOException { int value=in.readInt();if(value<0||value>max)throw new IOException("Lista inválida.");return value; }
}
