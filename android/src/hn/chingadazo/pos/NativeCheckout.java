package hn.chingadazo.pos;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;

/** Table-payment journal. Confirmation remains durable until downstream effects are integrated. */
final class NativeCheckout {
    interface Gateway {Map<String,Object> order(String id)throws IOException;void send(Map<String,Object> command)throws IOException;}
    static final class Intent {
        final NativeReceipt.Expected expected;final long revision;final boolean print,confirmed;
        Intent(NativeReceipt.Expected expected,long revision,boolean print,boolean confirmed)throws IOException{
            if(expected==null||revision<0||revision>9007199254740991L||!expected.id.equals("dining-"+expected.account))throw NativeAccess.malformed();
            this.expected=expected;this.revision=revision;this.print=print;this.confirmed=confirmed;
        }
        Map<String,Object> command(){return NativeAccess.map("action","checkout","accountId",expected.account,"operationId",expected.operation,"expectedRevision",revision,
            "shiftId",expected.shift,"payment",expected.payment,"payWith",BigDecimal.valueOf(expected.received,2));}
    }
    private final NativeDrafts.Store store;private final Gateway gateway;
    NativeCheckout(NativeDrafts.Store store,Gateway gateway){this.store=store;this.gateway=gateway;}
    synchronized Intent pending(String owner)throws IOException{
        owner(owner);byte[] bytes=store.read(owner);if(bytes==null)return null;
        try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes))){
            if(bytes.length==4&&in.readInt()==0)return null;
            if(bytes.length>4096||in.readInt()!=1)throw NativeAccess.malformed();
            NativeReceipt.Expected e=new NativeReceipt.Expected(in.readUTF(),in.readUTF(),in.readUTF(),in.readUTF(),in.readUTF(),in.readUTF(),in.readLong(),in.readUTF(),in.readLong(),in.readUTF());
            Intent result=new Intent(e,in.readLong(),in.readBoolean(),in.readBoolean());
            if(in.read()!=-1||!owner.equals(e.owner))throw NativeAccess.malformed();return result;
        }finally{Arrays.fill(bytes,(byte)0);}
    }
    private void save(String owner,Intent intent)throws IOException{
        NativeReceipt.Expected e=intent.expected;ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);out.writeInt(1);
        for(String s:new String[]{e.id,e.owner,e.operation,e.shift,e.account,e.table})out.writeUTF(s);
        out.writeLong(e.total);out.writeUTF(e.payment);out.writeLong(e.received);out.writeUTF(e.items);out.writeLong(intent.revision);out.writeBoolean(intent.print);out.writeBoolean(intent.confirmed);out.flush();
        byte[] bytes=buffer.toByteArray();try{store.write(owner,bytes);}finally{Arrays.fill(bytes,(byte)0);}
    }
    synchronized Intent run(String owner,Intent proposed)throws IOException{
        Intent intent=pending(owner);
        if(intent==null){if(proposed==null||proposed.confirmed||!owner.equals(proposed.expected.owner))throw NativeAccess.malformed();intent=proposed;save(owner,intent);}
        else if(proposed!=null)throw new IOException("Hay un cobro guardado. Consulta su resultado antes de iniciar otro.");
        if(intent.confirmed)return intent;
        Map<String,Object> receipt=gateway.order(intent.expected.id);
        if(receipt.isEmpty()){
            gateway.send(intent.command());
            receipt=gateway.order(intent.expected.id);
        }
        NativeReceipt.validate(intent.expected,receipt);
        Intent result=new Intent(intent.expected,intent.revision,intent.print,true);save(owner,result);return result;
    }
    private static void owner(String owner)throws IOException{if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();}
    synchronized void finish(String owner,NativeEffects effects)throws IOException{
        Intent intent=pending(owner);if(intent==null||!intent.confirmed)throw NativeAccess.malformed();
        Map<String,Object> receipt=gateway.order(intent.expected.id);
        NativeReceipt.validate(intent.expected,receipt);
        effects.enqueue(owner,intent.expected.operation,NativePaidEffects.create(intent,receipt));
        // The physical queue is durable first. Replaying this handoff cannot reset a sent job.
        store.write(owner,new byte[]{0,0,0,0});
    }
}
