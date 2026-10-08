package hn.chingadazo.pos;
import java.util.*;
public final class GeckoPolicyTest {
 private static final String ID="123e4567-e89b-42d3-a456-426614174000";
 private static Map<String,Object> request(String action){Map<String,Object> m=new HashMap<>();m.put("v",1);m.put("id",ID);m.put("action",action);return m;}
 private static void denied(Runnable r){try{r.run();throw new AssertionError("Accepted invalid command");}catch(IllegalArgumentException expected){}}
 public static void main(String[] args){
  Map<String,Object> print=request("print");print.put("text","TICKET\n");
  GeckoPolicy.Command c=GeckoPolicy.validate(print);if(!c.action.equals("print")||!c.text.equals("TICKET\n"))throw new AssertionError();
  print.put("drawer",false);denied(()->GeckoPolicy.validate(print));print.remove("drawer");
  print.put("text","\u001b@");denied(()->GeckoPolicy.validate(print));
  print.put("text",new String(new char[49153]).replace('\0','a'));denied(()->GeckoPolicy.validate(print));
  denied(()->GeckoPolicy.validate(request("raw")));
  Map<String,Object> bad=request("drawer");bad.put("text","ticket");denied(()->GeckoPolicy.validate(bad));
  bad.remove("text");bad.put("v",1.0);denied(()->GeckoPolicy.validate(bad));
  bad.put("v",1);bad.put("id","job_1");denied(()->GeckoPolicy.validate(bad));
  GeckoPolicy.validate(request("drawer"));GeckoPolicy.validate(request("cut"));
  System.out.println("Gecko Java policy: strict command/text/id checks pass");
 }
}
