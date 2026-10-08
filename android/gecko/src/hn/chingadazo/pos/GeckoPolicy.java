package hn.chingadazo.pos;
import java.util.Map;
import java.util.Arrays;
/** Final validation in Java; extension validation is not an authority. */
public final class GeckoPolicy {
 public static final String EXTENSION="pos.print@coresystem", NATIVE_APP="coresystem";
 public static final class Command {
  public final String id,action,text;
  private Command(String id,String action,String text){this.id=id;this.action=action;this.text=text;}
 }
 public static Command validate(Map<String,Object> m){
  if(m==null||!Integer.valueOf(1).equals(m.get("v"))||!(m.get("id") instanceof String)||!(m.get("action") instanceof String))throw new IllegalArgumentException("unsupported");
  String id=(String)m.get("id"),action=(String)m.get("action");
  if(!id.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")||!Arrays.asList("status","connect","print","drawer","cut").contains(action))throw new IllegalArgumentException("unsupported");
  for(String k:m.keySet())if(!Arrays.asList("v","id","action","text").contains(k))throw new IllegalArgumentException("unsupported");
  String text=null;
  if(action.equals("print")){
   if(m.size()!=4||!(m.get("text") instanceof String))throw new IllegalArgumentException("unsupported");
   text=(String)m.get("text");PrinterCore.ticket(text);
  }else if(m.size()!=3||m.containsKey("text"))throw new IllegalArgumentException("unsupported");
  return new Command(id,action,text);
 }
}
