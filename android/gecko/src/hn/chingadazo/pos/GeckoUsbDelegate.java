package hn.chingadazo.pos;
import org.mozilla.geckoview.*;
import org.json.JSONObject;
import android.os.*;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.nio.charset.StandardCharsets;

/** USB operations. Port validation is unchanged; physical work never runs on UI. */
public final class GeckoUsbDelegate implements WebExtension.MessageDelegate {
 private final WebExtension expected;private final GeckoUsbTransport usb;
 private final GeckoUsbTransport.Observer observer;
 private final Handler ui=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicBoolean busy=new AtomicBoolean();private final Set<String> seen=new HashSet<>();
 private volatile boolean closed,suspended;private volatile WebExtension.Port activePort;
 GeckoUsbDelegate(WebExtension expected,GeckoUsbTransport usb,GeckoUsbTransport.Observer observer){this.expected=expected;this.usb=usb;this.observer=observer;}
 private boolean trusted(WebExtension.Port port){
  WebExtension.MessageSender sender=port.sender;
  return !closed&&GeckoPolicy.NATIVE_APP.equals(port.name)&&sender!=null&&sender.webExtension==expected&&GeckoPolicy.EXTENSION.equals(sender.webExtension.id)&&sender.session==null&&sender.environmentType==WebExtension.MessageSender.ENV_TYPE_EXTENSION;
 }
 @Override public void onConnect(WebExtension.Port port){
  if(!trusted(port)){port.disconnect();return;}
  if(activePort!=null&&activePort!=port){WebExtension.Port old=activePort;activePort=null;old.disconnect();}
  activePort=port;
  port.setDelegate(new WebExtension.PortDelegate(){
   @Override public void onPortMessage(Object value,WebExtension.Port port){
    if(port!=activePort||!trusted(port)){port.disconnect();return;}
    GeckoPolicy.Command c;
    try{
     if(!(value instanceof JSONObject))throw new IllegalArgumentException();
     JSONObject json=(JSONObject)value;
     if(json.toString().getBytes(StandardCharsets.UTF_8).length>65536)throw new IllegalArgumentException();
     Map<String,Object> fields=new HashMap<>();Iterator<String> keys=json.keys();while(keys.hasNext()){String key=keys.next();fields.put(key,json.get(key));}
     c=GeckoPolicy.validate(fields);
    }catch(Exception error){observer.accept("Solicitud USB rechazada por validación.");port.disconnect();return;}
    if(seen.contains(c.id)||seen.size()>=4096){reply(port,c.id,null,"Solicitud repetida o límite alcanzado; no se envió al USB.");return;}
    seen.add(c.id);
    if(!busy.compareAndSet(false,true)){reply(port,c.id,null,"USB ocupado; espera el resultado anterior. No hay reintentos automáticos.");return;}
    worker.execute(()->{
     JSONObject result=null;String error=null;
     try{
      if(closed||suspended||activePort!=port)throw new IOException("App cerrada o en segundo plano; no se inició el envío.");
      switch(c.action){
       case "status":result=usb.status();break;
       case "connect":result=usb.connect();break;
       case "print":result=usb.send(GeckoUsbCommands.ticket(c.text));break;
       case "drawer":result=usb.send(usb.drawer());break;
       case "cut":result=usb.send(GeckoUsbCommands.cut());break;
       default:throw new IOException("Acción USB no admitida.");
      }
     }catch(IOException|IllegalArgumentException e){error=e.getMessage();}catch(Exception e){error="Error USB. Comprueba el resultado físico antes de repetir; no vuelvas a cobrar.";}
     finally{busy.set(false);}
     JSONObject response=result;String failure=error;
     ui.post(()->reply(port,c.id,response,failure));
    });
   }
   @Override public void onDisconnect(WebExtension.Port port){if(activePort==port)activePort=null;}
  });
 }
 private void reply(WebExtension.Port port,String id,JSONObject result,String error){
  if(closed||port!=activePort||!trusted(port))return;
  try{
   JSONObject response=new JSONObject().put("id",id);
   if(error==null)response.put("result",result);else response.put("error",error);
   port.postMessage(response);
   android.util.Log.i("ChingadazoGecko",new JSONObject().put("id",id).put("entryPoint","java-usb").put("stage","port_response").put("ok",error==null).toString());
  }catch(Exception e){observer.accept("No se pudo devolver la respuesta. Comprueba papel/gaveta antes de repetir.");port.disconnect();}
 }
 void cutTest(){
  if(closed||suspended||!busy.compareAndSet(false,true)){observer.accept("USB ocupado o cerrado; no se envió corte.");return;}
  worker.execute(()->{try{if(!closed&&!suspended)usb.send(GeckoUsbCommands.cut());}catch(Exception e){observer.accept("No se completó el corte. Conecta USB y comprueba el papel antes de repetir.");}finally{busy.set(false);}});
 }
 void resume(){if(!closed){suspended=false;worker.execute(()->{if(!closed&&!suspended)usb.reconnectSaved();});}}
 void suspend(){suspended=true;if(!closed)worker.execute(usb::close);}
 void close(){
  closed=true;if(activePort!=null){WebExtension.Port old=activePort;activePort=null;old.disconnect();}
  worker.execute(usb::close);worker.shutdown();
 }
}
