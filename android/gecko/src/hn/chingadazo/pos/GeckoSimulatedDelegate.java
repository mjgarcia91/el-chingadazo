package hn.chingadazo.pos;
import org.mozilla.geckoview.*;
import org.json.JSONObject;
import java.util.*;
import java.nio.charset.StandardCharsets;
/** Internal evaluation only. No UsbManager, network writes or physical success. */
public final class GeckoSimulatedDelegate implements WebExtension.MessageDelegate {
 public interface StatusObserver {void accept(String status);}
 private final WebExtension expected;
 private final StatusObserver statusObserver;
 private final Set<String> seen=new HashSet<>();
 private boolean closed;
 private WebExtension.Port activePort;
 public GeckoSimulatedDelegate(WebExtension expected,StatusObserver statusObserver){this.expected=expected;this.statusObserver=statusObserver;}
 public void close(){closed=true;if(activePort!=null){WebExtension.Port old=activePort;activePort=null;old.disconnect();}}
 private boolean trusted(String nativeApp,WebExtension.MessageSender sender){
  return !closed&&GeckoPolicy.NATIVE_APP.equals(nativeApp)&&sender!=null&&sender.webExtension==expected&&GeckoPolicy.EXTENSION.equals(sender.webExtension.id)&&sender.session==null&&sender.environmentType==WebExtension.MessageSender.ENV_TYPE_EXTENSION;
 }
 @Override public void onConnect(WebExtension.Port port){
  if(!trusted(port.name,port.sender)){port.disconnect();return;}
  if(activePort!=null&&activePort!=port){WebExtension.Port old=activePort;activePort=null;old.disconnect();}
  activePort=port;
  port.setDelegate(new WebExtension.PortDelegate(){
   @Override public void onPortMessage(Object value,WebExtension.Port port){
    if(port!=activePort||!trusted(port.name,port.sender)){port.disconnect();return;}
    try{JSONObject reply=simulate(value);port.postMessage(reply);}
    catch(Exception error){statusObserver.accept("Java rechazó o no pudo responder · sin acceso USB.");activePort=null;port.disconnect();}
   }
   @Override public void onDisconnect(WebExtension.Port port){if(activePort==port)activePort=null;}
  });
 }
 private JSONObject simulate(Object value) throws Exception {
   if(!(value instanceof JSONObject))throw new IllegalArgumentException("unsupported");
   JSONObject json=(JSONObject)value;
   if(json.toString().getBytes(StandardCharsets.UTF_8).length>65536)throw new IllegalArgumentException("unsupported");
   Map<String,Object> fields=new HashMap<>();Iterator<String> keys=json.keys();while(keys.hasNext()){String key=keys.next();fields.put(key,json.get(key));}
   GeckoPolicy.Command c=GeckoPolicy.validate(fields);
   if(seen.contains(c.id)||seen.size()>=4096)throw new IllegalArgumentException("duplicate-or-capacity");seen.add(c.id);
   statusObserver.accept("Java recibió: "+c.action+" · SIMULADO, sin acceso USB.");
   JSONObject reply=new JSONObject().put("id",c.id);
   if(c.action.equals("status"))reply.put("result",new JSONObject().put("supported",true).put("configured",false).put("connected",false).put("transport","native").put("simulated",true));
   else reply.put("error","SIMULADO: canal recibido; no se envió al USB ni se abrió gaveta.");
   // Deliberately no ticket text, customer data or credentials in logs.
   android.util.Log.i("ChingadazoGecko",new JSONObject().put("entryPoint","java").put("id",c.id).put("action",c.action).put("stage","java_responds").put("simulated",true).toString());
   statusObserver.accept("Java recibió y responde: "+c.action+" ["+c.id.substring(0,8)+"] · SIMULADO, sin acceso USB.");
   return reply;
 }
}
