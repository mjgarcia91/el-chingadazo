package hn.chingadazo.pos;

import java.io.IOException;
import java.util.*;

public final class NativeAccessTest {
    static void check(boolean ok, String label) { if (!ok) throw new AssertionError(label); }
    interface Action { void run() throws Exception; }
    static void fails(Action action, String label) throws Exception {
        try { action.run(); } catch (IOException expected) { return; }
        throw new AssertionError(label);
    }
    static Map<String,Object> map(Object... entries) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i=0;i<entries.length;i+=2) result.put((String)entries[i], entries[i+1]);
        return result;
    }
    static Map<String,Object> profile(String role) {
        return map("id","auth-user1","authUid","user1","name","Operador","role",role,"active",true);
    }
    static Map<String,Object> tokens() {
        return map("idToken","id-token","refreshToken","refresh-token","localId","user1","expiresIn","3600");
    }
    static Map<String,Object> customTokens() {
        // Firebase signInWithCustomToken does not promise localId.
        return map("idToken","id-token","refreshToken","refresh-token","expiresIn","3600");
    }
    static class Memory implements NativeAccess.Vault {
        NativeAccess.Saved saved = NativeAccess.Saved.empty();
        boolean broken;
        public NativeAccess.Saved load() { return saved; }
        public void save(NativeAccess.Saved value) throws IOException {
            if (broken) throw new IOException("storage");
            saved=value;
        }
    }
    static class Fake implements NativeAccess.Wire {
        final List<NativeAccess.Request> requests = new ArrayList<>();
        final Deque<NativeAccess.Reply> replies = new ArrayDeque<>();
        Runnable during;
        Fake add(Map<String,Object> body) { return add(200,body,""); }
        Fake add(int status, Map<String,Object> body, String cookie) {
            replies.add(new NativeAccess.Reply(status,body,cookie)); return this;
        }
        public NativeAccess.Reply send(NativeAccess.Request request) throws IOException {
            requests.add(request);
            if(during!=null) { Runnable r=during; during=null; r.run(); }
            if(replies.isEmpty()) throw new IOException("simulated offline");
            return replies.remove();
        }
    }
    static NativeAccess client(Fake wire,Memory memory) { return new NativeAccess(wire,memory,()->1000L); }
    static Memory authorized() {
        Memory m=new Memory(); m.saved=new NativeAccess.Saved("device-cookie",100000L,"",""); return m;
    }
    public static void main(String[] args) throws Exception {
        Fake f=new Fake().add(tokens()).add(profile("admin"))
            .add(200,map("ok",true,"expires",100000L),"device-cookie");
        Memory m=new Memory(); NativeAccess c=client(f,m);
        check(c.authorize("admin@example.test","not-a-real-password").role.equals("admin"),"authorize admin");
        check(m.saved.cookie.equals("device-cookie"),"persist authorization");
        check(m.saved.refresh.equals("refresh-token"),"persist renewal only");
        check(f.requests.get(0).endpoint==NativeAccess.Endpoint.PASSWORD,"password Firebase only");
        check(f.requests.get(0).bearer.isEmpty() && f.requests.get(0).cookie.isEmpty(),"no Worker secrets to Firebase");
        check(f.requests.get(1).bearer.equals("id-token"),"ID token to staff-me");

        Fake pin=new Fake().add(map("token","custom-token","profile",profile("cashier")))
            .add(customTokens()).add(profile("cashier"));
        NativeAccess pc=client(pin,authorized());
        check(pc.login("123456").role.equals("cashier"),"PIN access");
        check(pin.requests.get(0).cookie.equals("device-cookie"),"cookie to PIN endpoint");
        check(pin.requests.get(1).endpoint==NativeAccess.Endpoint.CUSTOM,"exchange custom token");
        check(pin.requests.get(1).bearer.isEmpty() && pin.requests.get(1).cookie.isEmpty(),"no auth header on exchange");
        check(pin.requests.get(2).bearer.equals("id-token"),"never custom as Bearer");

        Fake missingPasswordUid=new Fake().add(customTokens());
        fails(()->client(missingPasswordUid,new Memory()).authorize("a@b.test","pw"),"password response still requires UID");
        Map<String,Object> badClaim=profile("cashier"); badClaim.remove("authUid");
        Fake noClaim=new Fake().add(map("token","custom","profile",badClaim));
        fails(()->client(noClaim,authorized()).login("123456"),"PIN profile requires expected UID");
        Map<String,Object> otherClaim=profile("cashier"); otherClaim.put("id","auth-other");
        fails(()->client(new Fake().add(map("token","custom","profile",otherClaim)),authorized()).login("123456"),"claim ID matches UID");
        Map<String,Object> otherToken=tokens(); otherToken.put("localId","other");
        Fake differentToken=new Fake().add(map("token","custom","profile",profile("cashier"))).add(otherToken);
        fails(()->client(differentToken,authorized()).login("123456"),"optional exchange UID cannot contradict claim");
        for(String field:new String[]{"idToken","refreshToken","expiresIn"}) {
            Map<String,Object> incomplete=customTokens(); incomplete.remove(field);
            Fake brokenExchange=new Fake().add(map("token","custom","profile",profile("cashier"))).add(incomplete);
            Memory unsaved=authorized(); NativeAccess rejectedExchange=client(brokenExchange,unsaved);
            fails(()->rejectedExchange.login("123456"),"required exchange field "+field);
            check(rejectedExchange.profile()==null && unsaved.saved.refresh.isEmpty(),"invalid exchange grants no session");
        }
        Memory wrongIdentity=authorized();
        Fake verifiedOther=new Fake().add(map("token","custom","profile",profile("cashier"))).add(customTokens())
            .add(map("id","auth-other","authUid","other","role","cashier","name","Other","active",true));
        NativeAccess wrongClient=client(verifiedOther,wrongIdentity);
        fails(()->wrongClient.login("123456"),"server verified identity must match even without exchange UID");
        check(wrongClient.profile()==null && wrongIdentity.saved.refresh.isEmpty(),"identity mismatch never persists");

        Fake invalid=new Fake(); NativeAccess ic=client(invalid,authorized());
        for(String value:new String[]{"12345","1234567","12 456","abcdef","１２３４５６"})
            fails(()->ic.login(value),"invalid PIN");
        check(invalid.requests.isEmpty(),"bad PIN stays local");
        fails(()->client(new Fake(),new Memory()).login("123456"),"device required");
        for(int status:new int[]{400,401,403,429,503}) {
            Fake denied=new Fake().add(status,map("error","do not reflect this"),"");
            NativeAccess dc=client(denied,authorized());
            fails(()->dc.login("123456"),"HTTP rejection");
            check(denied.requests.size()==1 && dc.profile()==null,"no retry or profile on error");
        }
        Fake notAdmin=new Fake().add(tokens()).add(profile("cashier"));
        fails(()->client(notAdmin,new Memory()).authorize("a@b.test","pw"),"cashier cannot authorize");
        check(notAdmin.requests.size()==2,"no device mutation for cashier");
        Fake malformed=new Fake().add(map("token",true));
        fails(()->client(malformed,authorized()).login("123456"),"strict JSON types");
        Fake inactive=new Fake().add(map("token","custom","profile",profile("cashier"))).add(tokens())
            .add(map("id","auth-user1","authUid","user1","role","cashier","name","User","active",false));
        fails(()->client(inactive,authorized()).login("123456"),"inactive profile");
        Fake wrong=new Fake().add(map("token","custom","profile",profile("cashier"))).add(tokens())
            .add(map("id","auth-other","authUid","other","role","cashier","name","Other"));
        fails(()->client(wrong,authorized()).login("123456"),"identity mismatch");
        Fake storage=new Fake().add(map("token","custom","profile",profile("cashier"))).add(tokens()).add(profile("cashier"));
        Memory broken=authorized(); broken.broken=true; NativeAccess bc=client(storage,broken);
        fails(()->bc.login("123456"),"storage failure");
        check(bc.profile()==null,"no success before durable state");
        Memory resume=authorized(); resume.saved=new NativeAccess.Saved("device-cookie",100000L,"old-refresh","user1");
        Fake renewal=new Fake().add(map("id_token","new-id","refresh_token","new-refresh","user_id","user1","expires_in","3600"))
            .add(profile("cashier"));
        NativeAccess rc=client(renewal,resume);
        check(rc.restore().id.equals("auth-user1"),"restore verifies profile");
        check(renewal.requests.get(0).endpoint==NativeAccess.Endpoint.REFRESH,"renew via dedicated destination");
        check(renewal.requests.get(0).cookie.isEmpty(),"no Worker cookie on renewal");
        check(resume.saved.refresh.equals("new-refresh"),"rotated token persisted");
        rc.logout(false);
        check(rc.profile()==null && resume.saved.refresh.isEmpty() && resume.saved.cookie.equals("device-cookie"),"logout keeps device only");
        rc.logout(true); check(resume.saved.cookie.isEmpty(),"explicit device deauthorization");

        Fake expired=new Fake(); Memory stale=authorized(); stale.saved=new NativeAccess.Saved("device-cookie",999L,"refresh","user1");
        fails(()->client(expired,stale).restore(),"expired device cannot restore");
        check(expired.requests.isEmpty(),"no auth after device expiry");
        check(stale.saved.cookie.isEmpty(),"expired authorization removed");
        Memory rejected=authorized(); rejected.saved=new NativeAccess.Saved("device-cookie",100000L,"revoked","user1");
        Fake revoked=new Fake().add(400,map("error",map("message","INVALID_REFRESH_TOKEN")),"");
        fails(()->client(revoked,rejected).restore(),"revoked session");
        check(rejected.saved.refresh.isEmpty(),"revoked refresh discarded");

        Memory cancelled=authorized(); Fake late=new Fake().add(map("token","custom","profile",profile("cashier"))).add(tokens()).add(profile("cashier"));
        NativeAccess lc=client(late,cancelled); late.during=lc::cancel;
        fails(()->lc.login("123456"),"late result after cancellation");
        check(lc.profile()==null && cancelled.saved.refresh.isEmpty(),"late response cannot persist session");
        Fake duplicate=new Fake().add(map("token","custom","profile",profile("cashier"))).add(tokens()).add(profile("cashier"));
        NativeAccess dc=client(duplicate,authorized());
        duplicate.during=()-> { try { fails(()->dc.login("123456"),"busy guard"); } catch(Exception e) { throw new AssertionError(e); } };
        dc.login("123456"); check(duplicate.requests.size()==3,"double tap never sends duplicate login");
        Memory offline=authorized(); offline.saved=new NativeAccess.Saved("device-cookie",100000L,"saved-refresh","user1");
        NativeAccess oc=client(new Fake(),offline);
        fails(oc::restore,"offline not authenticated");
        check(oc.profile()==null && offline.saved.refresh.equals("saved-refresh"),"network failure preserves recoverable session but grants no access");
        Memory previous=authorized(); previous.saved=new NativeAccess.Saved("device-cookie",100000L,"admin-refresh","user1");
        NativeAccess switching=client(new Fake().add(401,map(),""),previous);
        fails(()->switching.login("123456"),"failed switch");
        check(previous.saved.refresh.isEmpty(),"failed switch must not restore previous admin");
        Memory previous2=authorized(); previous2.saved=new NativeAccess.Saved("device-cookie",100000L,"admin-refresh","user1");
        fails(()->client(new Fake(),previous2).login("invalid"),"invalid PIN also switches away");
        check(previous2.saved.refresh.isEmpty(),"invalid PIN cannot leave previous renewal");
        System.out.println("Native access contracts and session recovery PASS");
    }
}
