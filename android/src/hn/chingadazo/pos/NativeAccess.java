package hn.chingadazo.pos;

import java.io.IOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Shared verified session; integrated UI may consult tables and release paid accounts. */
public final class NativeAccess {
    public enum Endpoint { PASSWORD, CUSTOM, REFRESH, AUTHORIZE, PIN, ME, PRODUCTS, CATEGORIES, DINING, RELEASE, CONSUME, TABLE_CHANGE, SHIFTS, SHIFT, OPEN_SHIFT, CLOSE_SHIFT, ORDER, CHECKOUT, CREATE_ORDER }
    public interface Wire { Reply send(Request request) throws IOException; }
    public interface Vault { Saved load() throws IOException; void save(Saved saved) throws IOException; }
    public interface Clock { long now(); }
    public static final class Saved {
        public final String cookie, refresh, uid;
        public final long cookieExpires;
        public Saved(String cookie,long expires,String refresh,String uid) {
            this.cookie=cookie; this.cookieExpires=expires; this.refresh=refresh; this.uid=uid;
        }
        public static Saved empty() { return new Saved("",0,"",""); }
    }
    public static final class Request {
        public final Endpoint endpoint;
        public final Map<String,Object> body;
        public final String bearer,cookie;
        Request(Endpoint endpoint,Map<String,Object> body,String bearer,String cookie) {
            this.endpoint=endpoint; this.body=Collections.unmodifiableMap(body);
            this.bearer=bearer; this.cookie=cookie;
        }
    }
    public static final class Reply {
        public final int status;
        public final Map<String,Object> body;
        public final String deviceCookie;
        public Reply(int status,Map<String,Object> body,String cookie) {
            this.status=status; this.body=body; this.deviceCookie=cookie;
        }
    }
    public static final class Profile {
        public final String id,name,role;
        Profile(String id,String name,String role) { this.id=id; this.name=name; this.role=role; }
    }
    public static final class Failure extends IOException {
        public final int status;
        Failure(int status,String message) { super(message); this.status=status; }
    }
    private static final class Operation {
        final long generation; final Saved saved;
        Operation(long generation,Saved saved) { this.generation=generation; this.saved=saved; }
    }
    private static final class Tokens {
        final String id,refresh,uid;
        Tokens(Map<String,Object> body) throws IOException {
            this(body,text(body,"localId",128));
        }
        Tokens(Map<String,Object> body,String expectedUid) throws IOException {
            id=text(body,"idToken",8192); refresh=text(body,"refreshToken",8192);
            uid=checked(expectedUid,128);
            if(body.containsKey("localId") && !uid.equals(text(body,"localId",128))) throw malformed();
            String seconds=text(body,"expiresIn",10);
            if(!seconds.matches("[0-9]{1,6}") || Long.parseLong(seconds)<=0) throw malformed();
        }
    }
    private final Wire wire; private final Vault vault; private final Clock clock;
    private long generation;
    private boolean busy;
    private Profile profile;
    public NativeAccess(Wire wire,Vault vault,Clock clock) {
        this.wire=wire; this.vault=vault; this.clock=clock;
    }
    public synchronized Profile profile() { return profile; }
    private synchronized Operation begin(boolean switchUser) throws IOException {
        if(busy) throw new Failure(0,"Hay una comprobación en curso.");
        profile=null;
        Saved saved=vault.load();
        if(switchUser && !saved.refresh.isEmpty()) {
            saved=new Saved(saved.cookie,saved.cookieExpires,"","");
            vault.save(saved);
        }
        busy=true;
        return new Operation(++generation,saved);
    }
    private synchronized Profile commit(Operation op,Saved saved,Profile next) throws IOException {
        if(op.generation!=generation) throw new Failure(0,"La sesión cambió. Vuelve a entrar.");
        vault.save(saved);
        profile=next;
        return next;
    }
    private synchronized void finish(Operation op) { if(op.generation==generation) busy=false; }
    public synchronized void cancel() { ++generation; busy=false; profile=null; }
    public synchronized void logout(boolean forgetDevice) throws IOException {
        cancel();
        Saved old=vault.load();
        vault.save(forgetDevice ? Saved.empty() : new Saved(old.cookie,old.cookieExpires,"",""));
    }

    public Profile restore() throws IOException {
        Operation op=begin(false);
        try {
            if(op.saved.refresh.isEmpty()) return null;
            if(op.saved.cookie.isEmpty() || op.saved.cookieExpires<=clock.now()) {
                throw new Failure(403,"La autorización del equipo venció. Autorízalo de nuevo.");
            }
            Reply reply=call(Endpoint.REFRESH,map("grant_type","refresh_token","refresh_token",op.saved.refresh),"","");
            Tokens tokens=new Tokens(map("idToken",reply.body.get("id_token"),"refreshToken",reply.body.get("refresh_token"),
                "localId",reply.body.get("user_id"),"expiresIn",reply.body.get("expires_in")));
            if(!tokens.uid.equals(op.saved.uid)) throw malformed();
            Profile next=me(tokens);
            return commit(op,new Saved(op.saved.cookie,op.saved.cookieExpires,tokens.refresh,tokens.uid),next);
        } catch(Failure failure) {
            if(failure.status==400 || failure.status==401 || failure.status==403)
                commit(op,op.saved.cookieExpires<=clock.now() ? Saved.empty() :
                    new Saved(op.saved.cookie,op.saved.cookieExpires,"",""),null);
            throw failure;
        } finally { finish(op); }
    }

    public Profile authorize(String email,String password) throws IOException {
        Operation op=begin(true);
        try {
            if(email==null || email.length()>254 || !email.contains("@") || password==null ||
                    password.isEmpty() || password.length()>4096) throw new Failure(400,"Escribe correo y contraseña de administrador.");
            Tokens tokens=new Tokens(call(Endpoint.PASSWORD,map("email",email.trim(),"password",password,"returnSecureToken",true),"","").body);
            Profile next=me(tokens);
            if(!next.role.equals("admin")) throw new Failure(403,"Solo un administrador puede autorizar el equipo.");
            Reply reply=call(Endpoint.AUTHORIZE,map(),tokens.id,"");
            if(!Boolean.TRUE.equals(reply.body.get("ok"))) throw malformed();
            Object value=reply.body.get("expires");
            if(!(value instanceof Number)) throw malformed();
            long expires=((Number)value).longValue();
            if(expires<=clock.now() || expires-clock.now()>31L*24*60*60*1000) throw malformed();
            String cookie=checked(reply.deviceCookie,8192);
            return commit(op,new Saved(cookie,expires,tokens.refresh,tokens.uid),next);
        } finally { finish(op); }
    }
    public Profile login(String pin) throws IOException {
        Operation op=begin(true);
        try {
            if(pin==null || !pin.matches("[0-9]{6}")) throw new Failure(400,"Escribe los seis números del PIN.");
            if(op.saved.cookie.isEmpty() || op.saved.cookieExpires<=clock.now())
                throw new Failure(403,"Autoriza primero este equipo con el administrador.");
            Reply reply=call(Endpoint.PIN,map("pin",pin),"",op.saved.cookie);
            String custom=text(reply.body,"token",8192);
            Map<String,Object> claimed=object(reply.body.get("profile"));
            String claimedId=text(claimed,"id",160);
            String claimedUid=text(claimed,"authUid",128);
            if(!claimedId.equals("auth-"+claimedUid)) throw malformed();
            // Custom-token exchange omits localId. ME verifies the ID token on the
            // server and must match this expected identity before any session is saved.
            Tokens tokens=new Tokens(call(Endpoint.CUSTOM,map("token",custom,"returnSecureToken",true),"","").body,claimedUid);
            Profile next=me(tokens);
            if(!next.id.equals(claimedId)) throw malformed();
            return commit(op,new Saved(op.saved.cookie,op.saved.cookieExpires,tokens.refresh,tokens.uid),next);
        } finally { finish(op); }
    }
    Map<String,Object> dining(String owner) throws IOException {
        return dining(owner,map(),Endpoint.DINING);
    }
    Map<String,Object> release(String owner,Map<String,Object> command) throws IOException {
        Map<String,Object> snapshot=new LinkedHashMap<>(command);
        NativeRoutes.release(snapshot);
        return dining(owner,snapshot,Endpoint.RELEASE);
    }
    Map<String,Object> consume(String owner,Map<String,Object> command)throws IOException {
        return dining(owner,NativeRoutes.consume(command),Endpoint.CONSUME);
    }
    Map<String,Object> tableChange(String owner,Map<String,Object> command)throws IOException {
        return dining(owner,NativeRoutes.tableChange(command),Endpoint.TABLE_CHANGE);
    }
    Map<String,Object> shifts(String owner)throws IOException {return dining(owner,map(),Endpoint.SHIFTS);}
    Map<String,Object> order(String owner,String id)throws IOException {
        Map<String,Object> body=map("id",id);NativeRoutes.shiftBody(Endpoint.SHIFT,body);return dining(owner,body,Endpoint.ORDER);
    }
    Map<String,Object> checkout(String owner,Map<String,Object> command)throws IOException {
        return dining(owner,NativeRoutes.checkout(command),Endpoint.CHECKOUT);
    }
    Map<String,Object> counter(String owner,Map<String,Object> command)throws IOException {
        Map<String,Object> body=NativeRoutes.counter(command);if(!owner.equals(body.get("userId")))throw malformed();
        return dining(owner,body,Endpoint.CREATE_ORDER);
    }
    Map<String,Object> shift(String owner,String id)throws IOException {
        Map<String,Object> body=map("id",id);NativeRoutes.shiftBody(Endpoint.SHIFT,body);return dining(owner,body,Endpoint.SHIFT);
    }
    Map<String,Object> changeShift(String owner,String name,Map<String,Object> command)throws IOException {
        boolean open="open".equals(command.get("action"));
        if(!open&&!"close".equals(command.get("action")))throw malformed();
        Endpoint endpoint=open?Endpoint.OPEN_SHIFT:Endpoint.CLOSE_SHIFT;
        Map<String,Object> body=open?map("id",command.get("id"),"userId",owner,"userName",name,"fondo",command.get("amount")):
            map("shiftId",command.get("id"),"counted",command.get("amount"),"note",command.get("note"));
        NativeRoutes.shiftBody(endpoint,body);Map<String,Object> reply=dining(owner,body,endpoint);
        return open?reply:object(reply.get("shift"));
    }
    private Map<String,Object> dining(String owner,Map<String,Object> command,Endpoint endpoint) throws IOException {
        Operation op=begin(false);
        try {
            if(op.saved.refresh.isEmpty() || !("auth-"+op.saved.uid).equals(owner) || op.saved.cookie.isEmpty() || op.saved.cookieExpires<=clock.now())
                throw new Failure(403,"Vuelve a iniciar sesión antes de consultar mesas.");
            Reply renewed=call(Endpoint.REFRESH,map("grant_type","refresh_token","refresh_token",op.saved.refresh),"","");
            Tokens tokens=new Tokens(map("idToken",renewed.body.get("id_token"),"refreshToken",renewed.body.get("refresh_token"),
                "localId",renewed.body.get("user_id"),"expiresIn",renewed.body.get("expires_in")));
            if(!tokens.uid.equals(op.saved.uid))throw malformed();
            Profile next=me(tokens);
            if(!owner.equals(next.id) || (!next.role.equals("admin") && !next.role.equals("cashier")))throw new Failure(403,"Sin permiso para consultar cuentas.");
              if(endpoint==Endpoint.TABLE_CHANGE&&"saveTable".equals(command.get("action"))&&!next.role.equals("admin"))throw new Failure(403,"Solo administración puede editar mesas.");
            commit(op,new Saved(op.saved.cookie,op.saved.cookieExpires,tokens.refresh,tokens.uid),next);
            synchronized(this){if(op.generation!=generation)throw new Failure(0,"La sesión cambió.");}
            Reply result=call(endpoint,command,tokens.id,"");
            synchronized(this){if(op.generation!=generation)throw new Failure(0,"La sesión cambió.");}
            return result.body;
        } finally {finish(op);}
    }
    private Profile me(Tokens tokens) throws IOException {
        Map<String,Object> body=call(Endpoint.ME,map(),tokens.id,"").body;
        String id=text(body,"id",160), role=text(body,"role",20), name=text(body,"name",200);
        if(!id.equals("auth-"+tokens.uid) || !tokens.uid.equals(text(body,"authUid",128))) throw malformed();
        if(body.containsKey("active") && !Boolean.TRUE.equals(body.get("active")))
            throw new Failure(403,"Usuario desactivado.");
        if(!role.equals("admin") && !role.equals("cashier") && !role.equals("kitchen"))
            throw new Failure(403,"Esta cuenta no tiene acceso de personal.");
        return new Profile(id,name,role);
    }
    private Reply call(Endpoint endpoint,Map<String,Object> body,String bearer,String cookie) throws IOException {
        Reply reply=wire.send(new Request(endpoint,body,bearer,cookie));
        if(reply==null || reply.body==null) throw malformed();
        if(reply.status!=200) {
            if(endpoint==Endpoint.DINING || endpoint==Endpoint.RELEASE || endpoint==Endpoint.CONSUME || endpoint==Endpoint.TABLE_CHANGE || endpoint==Endpoint.SHIFTS || endpoint==Endpoint.SHIFT || endpoint==Endpoint.OPEN_SHIFT || endpoint==Endpoint.CLOSE_SHIFT || endpoint==Endpoint.ORDER || endpoint==Endpoint.CHECKOUT || endpoint==Endpoint.CREATE_ORDER)
                throw new Failure(reply.status,"No se confirmó la operación ("+reply.status+"). Conserva el intento y consulta su resultado.");
            String message;
            switch(reply.status) {
                case 400: message="Acceso rechazado. Revisa los datos y la configuración de autenticación."; break;
                case 401: message="PIN incorrecto o sesión vencida. Vuelve a entrar."; break;
                case 403: message="Acceso no autorizado. Comprueba la autorización del equipo y tu usuario."; break;
                case 429: message="Demasiados intentos. Espera antes de volver a entrar."; break;
                default: message="El servidor no pudo confirmar el acceso. No se inició la sesión.";
            }
            throw new Failure(reply.status,message);
        }
        return reply;
    }
    static Map<String,Object> map(Object... entries) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<entries.length;i+=2) result.put((String)entries[i],entries[i+1]);
        return result;
    }
    @SuppressWarnings("unchecked")
    static Map<String,Object> object(Object value) throws IOException {
        if(!(value instanceof Map)) throw malformed();
        return (Map<String,Object>)value;
    }
    static String text(Map<String,Object> map,String key,int max) throws IOException {
        Object value=map.get(key);
        if(!(value instanceof String)) throw malformed();
        return checked((String)value,max);
    }
    static String checked(String value,int max) throws IOException {
        if(value==null || value.isEmpty() || value.length()>max || value.matches("(?s).*[\\x00-\\x1f\\x7f].*")) throw malformed();
        return value;
    }
    static Failure malformed() { return new Failure(0,"Respuesta de acceso no válida. No se inició la sesión."); }
}
