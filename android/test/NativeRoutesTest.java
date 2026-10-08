package hn.chingadazo.pos;

import java.io.IOException;
import java.util.Arrays;

public final class NativeRoutesTest {
    interface Action { void run() throws Exception; }
    static void check(boolean ok) { if(!ok) throw new AssertionError(); }
    static void rejects(Action action) throws Exception {
        try { action.run(); } catch(IOException expected) { return; }
        throw new AssertionError("must reject");
    }
    public static void main(String[] args) throws Exception {
        NativeAccess.Request pin=new NativeAccess.Request(NativeAccess.Endpoint.PIN,NativeAccess.map("pin","123456"),"","device");
        check(NativeRoutes.url(pin,"public-key").equals(NativeRoutes.ORIGIN+"/api/staff-login"));
        NativeAccess.Request password=new NativeAccess.Request(NativeAccess.Endpoint.PASSWORD,NativeAccess.map(),"","");
        check(NativeRoutes.url(password,"public-key").startsWith("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="));
        rejects(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.CUSTOM,NativeAccess.map(),"id","device"),"key"));
        rejects(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.ME,NativeAccess.map(),"id\r\nInjected: yes",""),"key"));
        rejects(()->NativeRoutes.url(new NativeAccess.Request(NativeAccess.Endpoint.PIN,NativeAccess.map(),"","bad; other=value"),"key"));
        check(NativeRoutes.deviceCookie(Arrays.asList("chingadazo_staff_device=123.abc%2D; Max-Age=2592000; Path=/api/; HttpOnly; Secure; SameSite=Strict")).equals("123.abc%2D"));
        rejects(()->NativeRoutes.deviceCookie(Arrays.asList("chingadazo_staff_device=value; Path=/; Secure; HttpOnly")));
        rejects(()->NativeRoutes.deviceCookie(Arrays.asList("chingadazo_staff_device=value; Path=/api/; Secure; HttpOnly; Domain=evil.test")));
        rejects(()->NativeRoutes.deviceCookie(Arrays.asList("chingadazo_staff_device=value; Path=/api/; HttpOnly")));
        rejects(()->NativeRoutes.deviceCookie(Arrays.asList("other=value")));
        NativeRoutes.checkJsonEnvelope("{\"text\":\"[ { \\\"\",\"ok\":true}");
        rejects(()->NativeRoutes.checkJsonEnvelope("[[[[[[[[[[[[[[[[0]]]]]]]]]]]]]]]]"));
        rejects(()->NativeRoutes.checkJsonEnvelope("{\"unclosed\":"));
        System.out.println("Native access destinations/cookies/JSON limits PASS");
    }
}
