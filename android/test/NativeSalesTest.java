package hn.chingadazo.pos;

import java.io.IOException;
import java.util.*;
import static hn.chingadazo.pos.NativeAccessTest.*;

public final class NativeSalesTest {
    static Map<String,Object> product() {
        return map("id","taco","name","Taco","category","comida","price",19.95,"available",true,
            "modifiers",Arrays.asList(map("id","salsa","name","Salsa","required",true,"multi",false,
                "options",Arrays.asList(map("id","roja","name","Roja","price",0.10),map("id","verde","name","Verde","price",0)))));
    }
    public static void main(String[] args) throws Exception {
        NativeSales.Product p=NativeSales.product(product());
        NativeSales.Line line=NativeSales.line(p,3,map("salsa","roja"),"Sin cebolla");
        check(line.unit==2005 && line.total()==6015,"decimal money stays exact");
        check(line.modsText.equals("Salsa: Roja"),"same modifier label as server");
        fails(()->NativeSales.line(p,1,map(),""),"required option");
        fails(()->NativeSales.line(p,1,map("salsa",Arrays.asList("roja","verde")),""),"single option only");
        fails(()->NativeSales.line(p,1,map("salsa","unknown"),""),"unknown option");
        fails(()->NativeSales.line(p,1,map("salsa","roja","injected","x"),""),"unknown group");
        fails(()->NativeSales.line(p,0,map("salsa","roja"),""),"positive quantity");
        fails(()->NativeSales.line(p,51,map("salsa","roja"),""),"quantity bounded");
        fails(()->NativeSales.line(p,1,map("salsa","roja"),"<script>"),"same note rejection as server");
        Map<String,Object> unavailable=product(); unavailable.put("available",false);
        fails(()->NativeSales.line(NativeSales.product(unavailable),1,map("salsa","roja"),""),"unavailable product");
        for(Object bad:new Object[]{Double.NaN,Double.POSITIVE_INFINITY,-1,0.001,"19.95",null}) {
            Map<String,Object> invalid=product(); invalid.put("price",bad);
            fails(()->NativeSales.product(invalid),"invalid money "+bad);
        }
        Map<String,Object> negative=product(); negative.put("price",0);
        negative.put("modifiers",Arrays.asList(map("id","salsa","name","Salsa","required",true,"multi",true,
            "options",Arrays.asList(map("id","roja","name","Roja","price",-1)))));
        NativeSales.Product discount=NativeSales.product(negative);
        fails(()->NativeSales.line(discount,1,map("salsa","roja"),""),"negative final unit");
        fails(()->NativeSales.line(discount,1,map("salsa",Arrays.asList("roja","roja")),""),"duplicate choices");
        List<NativeSales.Line> cart=NativeSales.replace(Collections.emptyList(),-1,line);
        check(cart.size()==1 && NativeSales.total(cart)==6015,"append line");
        check(NativeSales.replace(cart,0,NativeSales.line(p,1,map("salsa","verde"),"")).get(0).unit==1995,"edit line");
        check(NativeSales.replace(cart,0,null).isEmpty(),"remove line");
        List<NativeSales.Line> full=new ArrayList<>(); for(int i=0;i<50;i++)full.add(line);
        fails(()->NativeSales.replace(full,-1,line),"line limit");
        check(full.size()==50,"failed edit leaves source intact");
        fails(()->NativeSales.replace(cart,2,line),"stale index");
        check(NativeSales.money(6015).equals("L. 60.15"),"HNL format");
        System.out.println("Native sales prices/options/cart PASS");
    }
}
