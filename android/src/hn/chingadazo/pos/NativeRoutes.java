package hn.chingadazo.pos;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

final class NativeRoutes {
    static final String ORIGIN="https://el-chingadazo.magaa1825.workers.dev";
    static final String COOKIE="chingadazo_staff_device";
    static final int MAX_RESPONSE=524288;
    static boolean catalog(NativeAccess.Request request) {
        return request.endpoint==NativeAccess.Endpoint.PRODUCTS || request.endpoint==NativeAccess.Endpoint.CATEGORIES;
    }
    static String url(NativeAccess.Request request,String apiKey) throws IOException {
        if(apiKey==null || !apiKey.matches("[A-Za-z0-9_-]{1,200}")) throw NativeAccess.malformed();
        boolean firebase=request.endpoint==NativeAccess.Endpoint.PASSWORD || request.endpoint==NativeAccess.Endpoint.CUSTOM || request.endpoint==NativeAccess.Endpoint.REFRESH;
        if(firebase && (!request.bearer.isEmpty() || !request.cookie.isEmpty())) throw NativeAccess.malformed();
        if(catalog(request) && (!request.bearer.isEmpty() || !request.cookie.isEmpty() || !request.body.isEmpty())) throw NativeAccess.malformed();
        if(request.endpoint==NativeAccess.Endpoint.DINING && (request.bearer.isEmpty() || !request.body.isEmpty()))throw NativeAccess.malformed();
        if(request.endpoint==NativeAccess.Endpoint.RELEASE){if(request.bearer.isEmpty())throw NativeAccess.malformed();release(request.body);}
        if(request.endpoint==NativeAccess.Endpoint.CONSUME){if(request.bearer.isEmpty())throw NativeAccess.malformed();consume(request.body);}
        if(request.endpoint==NativeAccess.Endpoint.TABLE_CHANGE){if(request.bearer.isEmpty())throw NativeAccess.malformed();tableChange(request.body);}
        if(request.endpoint==NativeAccess.Endpoint.CHECKOUT){if(request.bearer.isEmpty())throw NativeAccess.malformed();checkout(request.body);}
        if(request.endpoint==NativeAccess.Endpoint.CREATE_ORDER){if(request.bearer.isEmpty())throw NativeAccess.malformed();counter(request.body);}
        if(request.endpoint==NativeAccess.Endpoint.ORDER){if(request.bearer.isEmpty())throw NativeAccess.malformed();shiftBody(NativeAccess.Endpoint.SHIFT,request.body);}
        if(request.endpoint==NativeAccess.Endpoint.SHIFTS||request.endpoint==NativeAccess.Endpoint.SHIFT||request.endpoint==NativeAccess.Endpoint.OPEN_SHIFT||request.endpoint==NativeAccess.Endpoint.CLOSE_SHIFT){
            if(request.bearer.isEmpty())throw NativeAccess.malformed();shiftBody(request.endpoint,request.body);
        }
        if(!request.bearer.isEmpty() && !request.bearer.matches("[A-Za-z0-9._~-]{1,8192}")) throw NativeAccess.malformed();
        if(!request.cookie.isEmpty() && !request.cookie.matches("[A-Za-z0-9._%~-]{1,8192}")) throw NativeAccess.malformed();
        if(request.endpoint!=NativeAccess.Endpoint.PIN && !request.cookie.isEmpty()) throw NativeAccess.malformed();
        if(request.endpoint==NativeAccess.Endpoint.PIN && (!request.bearer.isEmpty() || request.cookie.isEmpty())) throw NativeAccess.malformed();
        if((request.endpoint==NativeAccess.Endpoint.ME || request.endpoint==NativeAccess.Endpoint.AUTHORIZE) && request.bearer.isEmpty()) throw NativeAccess.malformed();
        switch(request.endpoint) {
            case PASSWORD: return "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+apiKey;
            case CUSTOM: return "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key="+apiKey;
            case REFRESH: return "https://securetoken.googleapis.com/v1/token?key="+apiKey;
            case AUTHORIZE: return ORIGIN+"/api/staff-authorize";
            case PIN: return ORIGIN+"/api/staff-login";
            case ME: return ORIGIN+"/api/staff-me";
            case PRODUCTS: return ORIGIN+"/api/data/products";
            case CATEGORIES: return ORIGIN+"/api/data/categories";
            case DINING: return ORIGIN+"/api/dining";
            case RELEASE: return ORIGIN+"/api/dining";
            case CONSUME: return ORIGIN+"/api/dining";
            case TABLE_CHANGE: return ORIGIN+"/api/dining";
            case SHIFTS: return ORIGIN+"/api/data/shifts";
            case SHIFT: case OPEN_SHIFT: return ORIGIN+"/api/data/shifts/"+key(request.body.get("id"));
            case CLOSE_SHIFT: return ORIGIN+"/api/close-shift";
            case ORDER: case CREATE_ORDER: return ORIGIN+"/api/data/orders/"+key(request.body.get("id"));
            case CHECKOUT: return ORIGIN+"/api/dining";
            default: throw NativeAccess.malformed();
        }
    }
    static void shiftBody(NativeAccess.Endpoint endpoint,java.util.Map<String,Object> body)throws IOException{
        if(endpoint==NativeAccess.Endpoint.SHIFTS){if(!body.isEmpty())throw NativeAccess.malformed();return;}
        boolean open=endpoint==NativeAccess.Endpoint.OPEN_SHIFT,read=endpoint==NativeAccess.Endpoint.SHIFT;
        if(!open&&!read&&endpoint!=NativeAccess.Endpoint.CLOSE_SHIFT)throw NativeAccess.malformed();
        if(body.size()!=(read?1:open?4:3))throw NativeAccess.malformed();key(body.get(read||open?"id":"shiftId"));if(read)return;
        if(open){String owner=NativeAccess.text(body,"userId",160);if(!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();NativeAccess.text(body,"userName",160);}
        else if(!(body.get("note") instanceof String)||((String)body.get("note")).length()>500)throw NativeAccess.malformed();
        Object raw=body.get(open?"fondo":"counted");if(!(raw instanceof Number))throw NativeAccess.malformed();
        try{java.math.BigDecimal value=new java.math.BigDecimal(raw.toString()).setScale(2,java.math.RoundingMode.UNNECESSARY);if(value.signum()<0||value.compareTo(new java.math.BigDecimal("1000000"))>0)throw NativeAccess.malformed();}
        catch(NumberFormatException|ArithmeticException e){throw NativeAccess.malformed();}
    }
    static java.util.Map<String,Object> counter(java.util.Map<String,Object> body)throws IOException{
        if(body==null||body.size()!=12||!Boolean.TRUE.equals(body.get("paidAt"))||!"Mostrador".equals(body.get("customerName"))||!"caja".equals(body.get("channel"))||!"pickup".equals(body.get("type")))throw NativeAccess.malformed();
        String id=key(body.get("id")),shift=key(body.get("shiftId")),owner=NativeAccess.text(body,"userId",160);
        if(!id.matches("counter-[A-Za-z0-9_-]{1,60}")||!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw NativeAccess.malformed();
        java.util.Map<String,Object> payment=checkout(NativeAccess.map("action","checkout","accountId",id,"operationId",id,"expectedRevision",0,"shiftId",shift,"payment",body.get("payment"),"payWith",body.get("payWith")));
        Object items=consume(NativeAccess.map("action","consume","operationId",id,"expectedRevision",0,"tableId",id,"accountId","","items",body.get("items"))).get("items");
        java.math.BigDecimal total=java.math.BigDecimal.ZERO;
        for(Object raw:(List<?>)items){java.util.Map<String,Object> line=NativeAccess.object(raw);total=total.add(((java.math.BigDecimal)line.get("unit")).multiply(java.math.BigDecimal.valueOf(((Number)line.get("qty")).longValue())));}
        java.math.BigDecimal received=(java.math.BigDecimal)payment.get("payWith");boolean cash="Efectivo".equals(payment.get("payment"));
        try{if(!(body.get("total") instanceof Number)||total.signum()<=0||total.compareTo(new java.math.BigDecimal("100000000"))>0||total.compareTo(new java.math.BigDecimal(body.get("total").toString()))!=0||cash&&received.compareTo(total)<0||!Boolean.valueOf(cash&&received.compareTo(total)>0).equals(body.get("needsChange")))throw NativeAccess.malformed();}
        catch(NumberFormatException e){throw NativeAccess.malformed();}
        return java.util.Collections.unmodifiableMap(NativeAccess.map("id",id,"userId",owner,"shiftId",shift,"items",items,"total",total,"payment",payment.get("payment"),"payWith",received,"paidAt",true,"customerName","Mostrador","channel","caja","type","pickup","needsChange",cash&&received.compareTo(total)>0));
    }
    static java.util.Map<String,Object> checkout(java.util.Map<String,Object> body)throws IOException{
        if(body==null||body.size()!=7||!"checkout".equals(body.get("action")))throw NativeAccess.malformed();
        String account=key(body.get("accountId")),shift=key(body.get("shiftId"));
        release(NativeAccess.map("action","release","accountId",account,"operationId",body.get("operationId"),"expectedRevision",body.get("expectedRevision")));
        Object payment=body.get("payment"),raw=body.get("payWith");
        if(!java.util.Arrays.asList("Efectivo","Tarjeta","Transferencia").contains(payment)||!(raw instanceof Number))throw NativeAccess.malformed();
        java.math.BigDecimal amount;
        try{amount=new java.math.BigDecimal(raw.toString()).setScale(2,java.math.RoundingMode.UNNECESSARY);if(amount.signum()<0||amount.compareTo(new java.math.BigDecimal("100000000"))>0||(!payment.equals("Efectivo")&&amount.signum()!=0))throw NativeAccess.malformed();}
        catch(NumberFormatException|ArithmeticException e){throw NativeAccess.malformed();}
        return java.util.Collections.unmodifiableMap(NativeAccess.map("action","checkout","accountId",account,"operationId",body.get("operationId"),"expectedRevision",integer(body.get("expectedRevision"),0,9007199254740991L),"shiftId",shift,"payment",payment,"payWith",amount));
    }
    static void release(java.util.Map<String,Object> body) throws IOException {
        if(body==null || body.size()!=4 || !"release".equals(body.get("action")))throw NativeAccess.malformed();
        for(String field:new String[]{"accountId","operationId"}) {
            Object raw=body.get(field);int max=field.equals("operationId")?80:100;
            if(!(raw instanceof String)||!((String)raw).matches("[A-Za-z0-9_-]{1,"+max+"}")||java.util.Arrays.asList("__proto__","constructor","prototype").contains(raw))throw NativeAccess.malformed();
        }
        Object raw=body.get("expectedRevision");if(!(raw instanceof Number))throw NativeAccess.malformed();
        try{long revision=new java.math.BigDecimal(raw.toString()).longValueExact();if(revision<0||revision>9007199254740991L)throw NativeAccess.malformed();}
        catch(ArithmeticException|NumberFormatException e){throw NativeAccess.malformed();}
    }
    // Validate and deep-copy the only allowed write shape; no arbitrary dining actions.
    static java.util.Map<String,Object> consume(java.util.Map<String,Object> body)throws IOException {
        if(body==null||body.size()!=6||!"consume".equals(body.get("action")))throw NativeAccess.malformed();
        String table=key(body.get("tableId")),account=body.get("accountId") instanceof String?(String)body.get("accountId"):null;
        if(account==null)throw NativeAccess.malformed();if(!account.isEmpty())key(account);
        release(NativeAccess.map("action","release","accountId",table,"operationId",body.get("operationId"),"expectedRevision",body.get("expectedRevision")));
        Object raw=body.get("items");if(!(raw instanceof List)||((List<?>)raw).isEmpty()||((List<?>)raw).size()>50)throw NativeAccess.malformed();
        java.util.List<Object> items=new java.util.ArrayList<>();
        for(Object value:(List<?>)raw){
            java.util.Map<String,Object> item=NativeAccess.object(value);
            if(item.size()!=5)throw NativeAccess.malformed();String product=key(item.get("productId"));
            long qty=integer(item.get("qty"),1,50);Object price=item.get("unit");
            if(!(price instanceof Number))throw NativeAccess.malformed();java.math.BigDecimal unit;
            try{unit=new java.math.BigDecimal(price.toString()).setScale(2,java.math.RoundingMode.UNNECESSARY);if(unit.signum()<0||unit.compareTo(new java.math.BigDecimal("1000000"))>0)throw NativeAccess.malformed();}
            catch(NumberFormatException|ArithmeticException e){throw NativeAccess.malformed();}
            Object note=item.get("note");if(!(note instanceof String)||((String)note).length()>500||((String)note).matches("(?s).*[<>\"`].*"))throw NativeAccess.malformed();
            java.util.Map<String,Object> mods=NativeAccess.object(item.get("mods")),copy=new java.util.LinkedHashMap<>();if(mods.size()>30)throw NativeAccess.malformed();
            for(java.util.Map.Entry<String,Object> entry:mods.entrySet()){
                String group=key(entry.getKey());Object choice=entry.getValue();
                if(choice instanceof String)copy.put(group,key(choice));
                else {if(!(choice instanceof List)||((List<?>)choice).size()>50)throw NativeAccess.malformed();java.util.List<String> choices=new java.util.ArrayList<>();
                    for(Object c:(List<?>)choice){String id=key(c);if(choices.contains(id))throw NativeAccess.malformed();choices.add(id);}copy.put(group,java.util.Collections.unmodifiableList(choices));}
            }
            items.add(java.util.Collections.unmodifiableMap(NativeAccess.map("productId",product,"qty",qty,"unit",unit,"mods",java.util.Collections.unmodifiableMap(copy),"note",note)));
        }
        return java.util.Collections.unmodifiableMap(NativeAccess.map("action","consume","operationId",body.get("operationId"),"expectedRevision",integer(body.get("expectedRevision"),0,9007199254740991L),
            "tableId",table,"accountId",account,"items",java.util.Collections.unmodifiableList(items)));
    }
    private static String key(Object raw)throws IOException {if(!(raw instanceof String)||!((String)raw).matches("[A-Za-z0-9_-]{1,100}")||java.util.Arrays.asList("__proto__","constructor","prototype").contains(raw))throw NativeAccess.malformed();return (String)raw;}
    private static long integer(Object raw,long min,long max)throws IOException {if(!(raw instanceof Number))throw NativeAccess.malformed();try{long n=new java.math.BigDecimal(raw.toString()).longValueExact();if(n<min||n>max)throw NativeAccess.malformed();return n;}catch(ArithmeticException|NumberFormatException e){throw NativeAccess.malformed();}}
    static java.util.Map<String,Object> tableChange(java.util.Map<String,Object> body)throws IOException {
        if(body==null||body.size()!=5)throw NativeAccess.malformed();Object action=body.get("action");
        boolean transfer="transfer".equals(action);if(!transfer&&!"saveTable".equals(action))throw NativeAccess.malformed();
        String id=key(body.get(transfer?"accountId":"tableId"));
        release(NativeAccess.map("action","release","accountId",id,"operationId",body.get("operationId"),"expectedRevision",body.get("expectedRevision")));
        java.util.Map<String,Object> result=NativeAccess.map("action",action,"operationId",body.get("operationId"),"expectedRevision",integer(body.get("expectedRevision"),0,9007199254740991L));
        if(transfer){result.put("accountId",id);result.put("destinationTableId",key(body.get("destinationTableId")));}
        else{
            java.util.Map<String,Object> t=NativeAccess.object(body.get("table"));
            if(t.size()!=7||!"salon".equals(t.get("zoneId"))||!"table".equals(t.get("kind"))||!Boolean.TRUE.equals(t.get("active"))||!Boolean.FALSE.equals(t.get("temporary")))throw NativeAccess.malformed();
            result.put("tableId",id);result.put("table",java.util.Collections.unmodifiableMap(NativeAccess.map("zoneId","salon","kind","table","number",integer(t.get("number"),1,999),
                "row",integer(t.get("row"),1,50),"column",integer(t.get("column"),1,4),"active",true,"temporary",false)));
        }
        return java.util.Collections.unmodifiableMap(result);
    }
    static String deviceCookie(List<String> headers) throws IOException {
        String value=null;
        for(String header:headers) {
            if(header==null || header.length()>10000) throw NativeAccess.malformed();
            String[] fields=header.split(";");
            if(!fields[0].trim().startsWith(COOKIE+"=")) continue;
            if(value!=null) throw NativeAccess.malformed();
            value=fields[0].trim().substring(COOKIE.length()+1);
            if(!value.matches("[A-Za-z0-9._%~-]{1,8192}")) throw NativeAccess.malformed();
            boolean secure=false,httpOnly=false,path=false;
            for(int i=1;i<fields.length;i++) {
                String field=fields[i].trim().toLowerCase(Locale.ROOT);
                if(field.equals("secure")) secure=true;
                if(field.equals("httponly")) httpOnly=true;
                if(field.equals("path=/api/")) path=true;
                if(field.startsWith("domain=")) throw NativeAccess.malformed();
            }
            if(!secure || !httpOnly || !path) throw NativeAccess.malformed();
        }
        if(value==null) throw NativeAccess.malformed();
        return value;
    }
    // Bound nesting before invoking Android's recursive JSON parser.
    static void checkJsonEnvelope(String text) throws IOException {
        if(text==null || text.length()>MAX_RESPONSE) throw NativeAccess.malformed();
        int depth=0; boolean quoted=false,escaped=false;
        for(int i=0;i<text.length();i++) {
            char c=text.charAt(i);
            if(quoted) {
                if(escaped) escaped=false;
                else if(c=='\\') escaped=true;
                else if(c=='"') quoted=false;
            } else if(c=='"') quoted=true;
            else if(c=='{' || c=='[') { if(++depth>12) throw NativeAccess.malformed(); }
            else if(c=='}' || c==']') { if(--depth<0) throw NativeAccess.malformed(); }
        }
        if(quoted || depth!=0) throw NativeAccess.malformed();
    }
}
