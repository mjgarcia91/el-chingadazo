package hn.chingadazo.pos;
import static hn.chingadazo.pos.NativeAccessTest.*;
public final class NativeImagePathTest {
    public static void main(String[] args)throws Exception{
        check(NativeImagePath.asset("assets/menu/birria.png").equals("menu/birria.png"),"bundled photo");
        check(NativeImagePath.asset("/assets/menu/tacos.png").equals("menu/tacos.png"),"root relative photo");
        for(String unsafe:new String[]{"../signing/private","file:///etc/passwd","https://evil.test/p.png","assets/menu/../../key.png","assets/menu/%2e%2e/key.png","assets/menu/photo.svg"})
            check(NativeImagePath.asset(unsafe).isEmpty(),"reject non-menu image: "+unsafe);
        System.out.println("Native menu image paths PASS");
    }
}
