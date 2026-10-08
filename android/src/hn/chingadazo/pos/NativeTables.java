package hn.chingadazo.pos;
import java.io.IOException;
import java.util.*;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Validated remote balances. A local empty cart says nothing about payment. */
final class NativeTables {
    static final class Table {
        final String id,accountId;final int number,row,column;final boolean active;
        Table(Map<String,Object> m)throws IOException{
            id=key(m,"id");accountId=optionalKey(m,"accountId");number=(int)integer(m.get("number"),1,999);
            row=(int)integer(m.get("row"),1,50);column=(int)integer(m.get("column"),1,4);
            if(!(m.get("active") instanceof Boolean))throw invalid();active=(Boolean)m.get("active");
        }
    }
    static final class Account {
        final String id,tableId,status,orderId;final long total;final List<String> items;
        Account(Map<String,Object> m)throws IOException{
            id=key(m,"id");tableId=key(m,"tableId");status=NativeAccess.text(m,"status",20);orderId=optionalKey(m,"orderId");
            if(!Arrays.asList("open","checkout","paid").contains(status))throw invalid();total=money(m.get("total"));
            List<String> lines=new ArrayList<>();Object raw=m.get("items");
            if(raw!=null){if(!(raw instanceof List)||((List<?>)raw).size()>200)throw invalid();
                for(Object item:(List<?>)raw){Map<String,Object> line=NativeAccess.object(item);long qty=integer(line.get("qty"),1,50),unit=money(line.get("unit"));
                    lines.add(qty+" × "+NativeAccess.text(line,"name",200)+" · "+NativeSales.money(qty*unit));}}
            items=Collections.unmodifiableList(lines);
        }
    }
    final long revision;final boolean initialized;final Map<String,Table> tables;final Map<String,Account> accounts;
    private NativeTables(long revision,boolean initialized,Map<String,Table> t,Map<String,Account> a){this.revision=revision;this.initialized=initialized;tables=Collections.unmodifiableMap(t);accounts=Collections.unmodifiableMap(a);}
    static NativeTables parse(Map<String,Object> m)throws IOException{
        if(!(m.get("initialized") instanceof Boolean))throw invalid();boolean initialized=(Boolean)m.get("initialized");
        long revision=integer(m.get("revision"),0,9007199254740991L);
        Map<String,Object> rt=NativeAccess.object(m.get("tables")),ra=NativeAccess.object(m.get("accounts"));
        if(rt.size()>200||ra.size()>200||(!initialized&&(!rt.isEmpty()||!ra.isEmpty())))throw invalid();
        Map<String,Table> tables=new LinkedHashMap<>();Map<String,Account> accounts=new LinkedHashMap<>();
        for(Map.Entry<String,Object> e:rt.entrySet()){Table t=new Table(NativeAccess.object(e.getValue()));if(!t.id.equals(e.getKey()))throw invalid();tables.put(t.id,t);}
        for(Map.Entry<String,Object> e:ra.entrySet()){Account a=new Account(NativeAccess.object(e.getValue()));if(!a.id.equals(e.getKey()))throw invalid();accounts.put(a.id,a);}
        for(Table t:tables.values())if(!t.accountId.isEmpty()){Account a=accounts.get(t.accountId);if(a==null||!a.tableId.equals(t.id))throw invalid();}
        for(Account a:accounts.values()){Table t=tables.get(a.tableId);if(t==null||!t.accountId.equals(a.id))throw invalid();}
        return new NativeTables(revision,initialized,tables,accounts);
    }
    Account account(String tableId){Table t=tables.get(tableId);return t==null?null:accounts.get(t.accountId);}
    long pending(String tableId){Account a=account(tableId);return a==null||a.status.equals("paid")?0:a.total;}
    boolean releasable(String tableId){Account a=account(tableId);return a!=null&&a.status.equals("paid")&&!a.orderId.isEmpty();}
    static String key(Map<String,Object> m,String field)throws IOException{String s=NativeAccess.text(m,field,100);if(!s.matches("[A-Za-z0-9_-]{1,100}")||Arrays.asList("__proto__","constructor","prototype").contains(s))throw invalid();return s;}
    static String optionalKey(Map<String,Object> m,String field)throws IOException{return !m.containsKey(field)||"".equals(m.get(field))?"":key(m,field);}
    static long integer(Object value,long min,long max)throws IOException{
        if(!(value instanceof Number))throw invalid();try{long n=new BigDecimal(value.toString()).longValueExact();if(n<min||n>max)throw invalid();return n;}catch(ArithmeticException|NumberFormatException e){throw invalid();}
    }
    static long money(Object value)throws IOException{
        if(!(value instanceof Number))throw invalid();try{BigDecimal n=new BigDecimal(value.toString()),rounded=n.setScale(2,RoundingMode.HALF_UP);
            if(n.subtract(rounded).abs().compareTo(new BigDecimal("0.000001"))>0||n.signum()<0)throw invalid();return integer(rounded.movePointRight(2),0,10000000000L);
        }catch(NumberFormatException e){throw invalid();}
    }
    static IOException invalid(){return new IOException("No se pudo validar el estado de mesas. Actualiza; no borres cuentas.");}
}
