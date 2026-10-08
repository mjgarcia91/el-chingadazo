package hn.chingadazo.pos;
import java.io.*;
import java.util.*;
import java.math.BigDecimal;
import java.security.*;

/** A successful HTTP response is not proof of a paid sale. Compare the durable expectation. */
final class NativeReceipt {
    static final class Expected {
        final String id,owner,operation,shift,account,table,payment,items;final long total,received;
        Expected(String id,String owner,String operation,String shift,String account,String table,long total,String payment,long received,String items)throws IOException{
            for(String key:new String[]{id,operation,shift,account,table})NativeTables.key(NativeAccess.map("key",key),"key");
            if(owner==null||!owner.matches("auth-[A-Za-z0-9_-]{1,128}")||operation.length()>80||total<=0||total>10000000000L||received<0||received>10000000000L||
                !Arrays.asList("Efectivo","Tarjeta","Transferencia").contains(payment)||items==null||!items.matches("[a-f0-9]{64}")||
                (payment.equals("Efectivo")?received<total:received!=0))throw NativeAccess.malformed();
            this.id=id;this.owner=owner;this.operation=operation;this.shift=shift;this.account=account;this.table=table;this.total=total;this.payment=payment;this.received=received;this.items=items;
        }
    }
    static void validate(Expected e,Map<String,Object> sale)throws IOException{
        for(String key:new String[]{"testArchivedAt","cancelledAt"})if(sale.get(key)!=null&&!"".equals(sale.get(key)))throw invalid();
        if(!e.id.equals(sale.get("id"))||!e.owner.equals(sale.get("userId"))||!e.owner.equals(sale.get("paidBy"))||!e.owner.equals(sale.get("invoicedBy"))||
            !e.operation.equals(sale.get("revision"))||!e.shift.equals(sale.get("shiftId"))||!e.account.equals(sale.get("diningAccountId"))||!e.table.equals(sale.get("tableId"))||
            !"facturada".equals(sale.get("status"))||!Boolean.TRUE.equals(sale.get("invoiced"))||!e.payment.equals(sale.get("payment")))throw invalid();
        NativeShifts.time(NativeAccess.text(sale,"paidAt",30));NativeShifts.time(NativeAccess.text(sale,"invoicedAt",30));
        if(NativeTables.money(sale.get("total"))!=e.total||NativeTables.money(sale.get("subtotal"))!=e.total||NativeTables.money(sale.get("payWith"))!=e.received||
            NativeTables.money(sale.get("changeGiven"))!=(e.payment.equals("Efectivo")?e.received-e.total:0))throw invalid();
        for(String key:new String[]{"tax","deliveryFee","tip","redeemValue"})if(NativeTables.money(sale.get(key))!=0)throw invalid();
        if(!e.items.equals(itemsFingerprint(sale.get("items"))))throw invalid();
        long sum=0;for(Object raw:(List<?>)sale.get("items")){Map<String,Object> line=NativeAccess.object(raw);sum+=NativeTables.integer(line.get("qty"),1,50)*NativeTables.money(line.get("unit"));}
        if(sum!=e.total)throw invalid();
    }
    static String itemsFingerprint(Object raw)throws IOException{
        if(!(raw instanceof List)||((List<?>)raw).isEmpty()||((List<?>)raw).size()>200)throw invalid();
        for(Object item:(List<?>)raw){Map<String,Object> line=NativeAccess.object(item);NativeTables.key(line,"productId");NativeAccess.text(line,"name",200);NativeTables.integer(line.get("qty"),1,50);NativeTables.money(line.get("unit"));}
        ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);canonical(raw,out,buffer,0);out.flush();byte[] bytes=buffer.toByteArray();
        try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder value=new StringBuilder();for(byte b:hash)value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
        catch(NoSuchAlgorithmException impossible){throw new IOException("No se pudo verificar el comprobante.");}finally{Arrays.fill(bytes,(byte)0);}
    }
    private static void canonical(Object value,DataOutputStream out,ByteArrayOutputStream buffer,int depth)throws IOException{
        if(depth>12||buffer.size()>262144)throw invalid();
        if(value==null){out.writeByte(0);}
        else if(value instanceof String){String s=(String)value;if(s.length()>2048)throw invalid();out.writeByte(1);out.writeUTF(s);}
        else if(value instanceof Boolean){out.writeByte(2);out.writeBoolean((Boolean)value);}
        else if(value instanceof Number){try{BigDecimal n=new BigDecimal(value.toString()).stripTrailingZeros();if(n.precision()>30||Math.abs(n.scale())>30)throw invalid();out.writeByte(3);out.writeUTF(n.toPlainString());}catch(NumberFormatException e){throw invalid();}}
        else if(value instanceof List){List<?> list=(List<?>)value;if(list.size()>200)throw invalid();out.writeByte(4);out.writeInt(list.size());for(Object item:list)canonical(item,out,buffer,depth+1);}
        else if(value instanceof Map){Map<String,Object> map=NativeAccess.object(value);if(map.size()>100)throw invalid();out.writeByte(5);out.writeInt(map.size());List<String> keys=new ArrayList<>(map.keySet());Collections.sort(keys);for(String key:keys){canonical(key,out,buffer,depth+1);canonical(map.get(key),out,buffer,depth+1);}}
        else throw invalid();
        if(buffer.size()>262144)throw invalid();
    }
    private static IOException invalid(){return new IOException("Comprobante sin confirmar o discrepante. No vuelvas a cobrar; conserva el intento.");}
}
