package hn.chingadazo.pos;

import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;

public final class NativeCatalogTest {
    public static void main(String[] args) throws Exception {
        Map<String,Object> categories=map("comida",map("id","comida","name","Comida"));
        NativeCatalog catalog=NativeCatalog.parse(map("taco",NativeSalesTest.product()),categories);
        check(catalog.products.size()==1 && catalog.categories.size()==1,"catalog contract");
        check(catalog.products.get(0).groups.get(0).options.size()==2,"modifiers preserved");
        fails(()->NativeCatalog.parse(map("a",NativeSalesTest.product(),"b",NativeSalesTest.product()),categories),"duplicate products");
        fails(()->NativeCatalog.parse(map("taco",NativeSalesTest.product()),map()),"unknown category");
        check(NativeCatalog.parse(map(),map()).products.isEmpty(),"empty menu explicit");
        Fake wire=new Fake().add(map("taco",NativeSalesTest.product())).add(categories);
        check(NativeCatalog.fetch(wire).products.size()==1,"network load");
        for(NativeAccess.Request request:wire.requests) {
            check(request.bearer.isEmpty()&&request.cookie.isEmpty()&&request.body.isEmpty(),"public catalog has no credentials");
            String url=NativeRoutes.url(request,"key");
            check(url.equals(NativeRoutes.ORIGIN+"/api/data/products")||url.equals(NativeRoutes.ORIGIN+"/api/data/categories"),"fixed catalog paths");
        }
        fails(()->NativeCatalog.fetch(new Fake().add(503,map(),"")),"failed fetch not empty catalog");
        System.out.println("Native catalog contracts PASS");
    }
}
