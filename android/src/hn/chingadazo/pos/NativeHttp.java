package hn.chingadazo.pos;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.json.JSONException;
import java.io.*;
import java.net.URL;
import java.net.URLEncoder;
import java.util.*;
import javax.net.ssl.HttpsURLConnection;

/** Fixed endpoints only; no global cookie jar, redirects, custom trust manager or retries. */
final class NativeHttp implements NativeAccess.Wire {
    // Public Firebase project configuration, identical to js/instance-config.js (not a service credential).
    static final String API_KEY="AIzaSyCIr8aTomtdtofsW32QSN2RSc6jS_nVxFI";

    public NativeAccess.Reply send(NativeAccess.Request request) throws IOException {
        URL url=new URL(NativeRoutes.url(request,API_KEY));
        HttpsURLConnection connection=(HttpsURLConnection)url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Cache-Control","no-store");
            if(!request.bearer.isEmpty()) connection.setRequestProperty("Authorization","Bearer "+request.bearer);
            if(!request.cookie.isEmpty()) connection.setRequestProperty("Cookie",NativeRoutes.COOKIE+"="+request.cookie);
            if(request.endpoint==NativeAccess.Endpoint.ME || request.endpoint==NativeAccess.Endpoint.DINING || request.endpoint==NativeAccess.Endpoint.SHIFT || request.endpoint==NativeAccess.Endpoint.SHIFTS || request.endpoint==NativeAccess.Endpoint.ORDER || NativeRoutes.catalog(request)) connection.setRequestMethod("GET");
            else {
                connection.setRequestMethod(request.endpoint==NativeAccess.Endpoint.OPEN_SHIFT||request.endpoint==NativeAccess.Endpoint.CREATE_ORDER?"PUT":"POST"); connection.setDoOutput(true);
                boolean form=request.endpoint==NativeAccess.Endpoint.REFRESH;
                connection.setRequestProperty("Content-Type",form ? "application/x-www-form-urlencoded" : "application/json; charset=utf-8");
                byte[] body=request.endpoint==NativeAccess.Endpoint.CONSUME?consumptionBody(request.body):(form ? form(request.body) : new JSONObject(request.body).toString()).getBytes("UTF-8");
                if(body.length>65536) throw NativeAccess.malformed();
                connection.setFixedLengthStreamingMode(body.length);
                try(OutputStream out=connection.getOutputStream()) { out.write(body); }
                finally { Arrays.fill(body,(byte)0); }
            }
            int status=connection.getResponseCode();
            if(status!=200) return new NativeAccess.Reply(status,NativeAccess.map(),"");
            if(connection.getContentLength()>NativeRoutes.MAX_RESPONSE) throw NativeAccess.malformed();
            String type=connection.getContentType();
            if(type==null || !type.toLowerCase(Locale.ROOT).startsWith("application/json")) throw NativeAccess.malformed();
            byte[] bytes;
            long deadline=System.nanoTime()+20_000_000_000L;
            try(InputStream in=connection.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[4096]; int n;
                while((n=in.read(buffer))!=-1) {
                    if(out.size()+n>NativeRoutes.MAX_RESPONSE || System.nanoTime()>deadline) throw NativeAccess.malformed();
                    out.write(buffer,0,n);
                }
                bytes=out.toByteArray();
            }
            String raw=new String(bytes,"UTF-8"); Arrays.fill(bytes,(byte)0);
            NativeRoutes.checkJsonEnvelope(raw);
            Map<String,Object> result;
            try {
                JSONTokener parser=new JSONTokener(raw);
                Object object=parser.nextValue();
                if(parser.nextClean()!=0) throw NativeAccess.malformed();
                if(object==JSONObject.NULL && (NativeRoutes.catalog(request)||request.endpoint==NativeAccess.Endpoint.SHIFT||request.endpoint==NativeAccess.Endpoint.SHIFTS||request.endpoint==NativeAccess.Endpoint.ORDER)) result=NativeAccess.map();
                else if(object instanceof JSONObject) result=decode((JSONObject)object);
                else throw NativeAccess.malformed();
            } catch(JSONException e) { throw NativeAccess.malformed(); }
            String cookie="";
            if(request.endpoint==NativeAccess.Endpoint.AUTHORIZE) {
                List<String> cookies=new ArrayList<>();
                for(Map.Entry<String,List<String>> h:connection.getHeaderFields().entrySet())
                    if("Set-Cookie".equalsIgnoreCase(h.getKey()) && h.getValue()!=null) cookies.addAll(h.getValue());
                cookie=NativeRoutes.deviceCookie(cookies);
            }
            return new NativeAccess.Reply(status,result,cookie);
        } finally { connection.disconnect(); }
    }
    static byte[] consumptionBody(Map<String,Object> command)throws IOException {
        byte[] body=new JSONObject(NativeRoutes.consume(command)).toString().getBytes("UTF-8");
        if(body.length>12000){Arrays.fill(body,(byte)0);throw new IOException("El pedido supera el límite de envío. Reduce las notas o divide los productos antes de enviarlo.");}return body;
    }
    static void validateConsumption(Map<String,Object> command)throws IOException {byte[] body=consumptionBody(command);Arrays.fill(body,(byte)0);}
    private static String form(Map<String,Object> body) throws IOException {
        StringBuilder value=new StringBuilder();
        for(Map.Entry<String,Object> item:body.entrySet()) {
            if(!(item.getValue() instanceof String)) throw NativeAccess.malformed();
            if(value.length()>0) value.append('&');
            value.append(URLEncoder.encode(item.getKey(),"UTF-8")).append('=')
                 .append(URLEncoder.encode((String)item.getValue(),"UTF-8"));
        }
        return value.toString();
    }
    private static Map<String,Object> decode(JSONObject object) throws JSONException,IOException {
        Map<String,Object> result=new LinkedHashMap<>();
        Iterator<String> keys=object.keys();
        while(keys.hasNext()) {
            if(result.size()>1024) throw NativeAccess.malformed();
            String key=keys.next(); Object value=object.get(key);
            if(value instanceof JSONObject) value=decode((JSONObject)value);
            if(value instanceof org.json.JSONArray) value=decodeArray((org.json.JSONArray)value);
            if(value==JSONObject.NULL) value=null;
            result.put(key,value);
        }
        return result;
    }
    private static List<Object> decodeArray(org.json.JSONArray array) throws JSONException,IOException {
        if(array.length()>1024)throw NativeAccess.malformed();
        List<Object> result=new ArrayList<>();
        for(int i=0;i<array.length();i++) {
            Object value=array.get(i);
            if(value instanceof JSONObject)value=decode((JSONObject)value);
            else if(value instanceof org.json.JSONArray)value=decodeArray((org.json.JSONArray)value);
            else if(value==JSONObject.NULL)value=null;
            result.add(value);
        }
        return result;
    }
}
