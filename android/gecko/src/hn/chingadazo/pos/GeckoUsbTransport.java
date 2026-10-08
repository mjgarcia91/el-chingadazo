package hn.chingadazo.pos;
import android.app.*;
import android.content.*;
import android.os.Build;
import android.hardware.usb.*;
import org.json.*;
import java.io.IOException;
import java.util.*;

/** Selection/permission on UI; connect/status/send/close serialized by GeckoUsbDelegate. */
final class GeckoUsbTransport {
 interface Observer {void accept(String text);}
 private final Activity activity;private final UsbManager manager;private final Observer observer;
 private final String permissionAction;
 private final SharedPreferences preferences;
 private volatile Candidate selected;private volatile int drawerPin;
 private UsbDeviceConnection connection;private Candidate opened;
 private boolean disposed;
 private static final class Candidate {
  final UsbDevice device;final UsbInterface iface;final UsbEndpoint endpoint;
  boolean kernelDetachApproved;
  Candidate(UsbDevice d,UsbInterface i,UsbEndpoint e){device=d;iface=i;endpoint=e;}
  String key(){return device.getVendorId()+":"+device.getProductId()+":"+iface.getId()+":"+iface.getAlternateSetting()+":"+iface.getInterfaceClass()+":"+iface.getInterfaceSubclass()+":"+iface.getInterfaceProtocol()+":"+endpoint.getAddress()+":"+endpoint.getType()+":"+endpoint.getMaxPacketSize();}
  String label(){return "VID "+device.getVendorId()+" : PID "+device.getProductId()+" · interfaz "+iface.getId()+" alt "+iface.getAlternateSetting()+" · OUT "+endpoint.getAddress()+" · clase "+iface.getInterfaceClass();}
 }
 private final BroadcastReceiver permissionReceiver=new BroadcastReceiver(){
  @Override public void onReceive(Context context,Intent intent){
   if(!permissionAction.equals(intent.getAction())||disposed)return;
   Candidate c=selected;if(c==null)return;
   // Query the OS, not untrusted broadcast extras. Grant never writes or opens USB.
   observer.accept((manager.hasPermission(c.device)?"Permiso USB concedido. Pulsa Conectar.":"Sin permiso USB. Pulsa Conectar para solicitarlo.")+"\n"+c.label());
  }
 };
 GeckoUsbTransport(Activity activity,Observer observer){
  this.activity=activity;this.observer=observer;manager=(UsbManager)activity.getSystemService(Context.USB_SERVICE);
  preferences=activity.getSharedPreferences("gecko_usb",Context.MODE_PRIVATE);
  drawerPin=GeckoUsbSelection.pin(preferences.getInt("drawerPin",0));
  permissionAction=activity.getPackageName()+".GECKO_USB_PERMISSION";
  IntentFilter filter=new IntentFilter(permissionAction);
  if(Build.VERSION.SDK_INT>=33)activity.registerReceiver(permissionReceiver,filter,Context.RECEIVER_NOT_EXPORTED);
  else activity.registerReceiver(permissionReceiver,filter);
 }
 private List<Candidate> candidates(){
  List<Candidate> list=new ArrayList<>();if(manager==null)return list;
  for(UsbDevice d:manager.getDeviceList().values())for(int i=0;i<d.getInterfaceCount();i++){
   UsbInterface face=d.getInterface(i);
   for(int e=0;e<face.getEndpointCount();e++){
    UsbEndpoint endpoint=face.getEndpoint(e);
    if(GeckoUsbCommands.candidate(face.getInterfaceClass(),face.getInterfaceSubclass(),face.getInterfaceProtocol(),endpoint.getDirection(),endpoint.getType())&&list.size()<32)list.add(new Candidate(d,face,endpoint));
   }
  }
  return list;
 }
 private String inventory(){
  StringBuilder out=new StringBuilder("USB detectados:");int count=0;
  if(manager!=null)for(UsbDevice d:manager.getDeviceList().values()){
   if(count++>=16){out.append("\nLista truncada.");break;}
   out.append("\nVID ").append(d.getVendorId()).append(" : PID ").append(d.getProductId()).append(" · interfaces ").append(d.getInterfaceCount());
  }
  if(count==0)out.append(" ninguno");return out.toString();
 }
 void choose(){
  if(disposed)return;
  List<Candidate> choices=candidates();observer.accept(inventory());
  if(choices.isEmpty()){new AlertDialog.Builder(activity).setTitle("USB de la caja").setMessage(inventory()+"\nNo hay interfaz de impresora o fabricante con BULK OUT compatible. No se enviaron comandos.").setPositiveButton("Cerrar",null).show();return;}
  String[] names=new String[choices.size()];for(int i=0;i<names.length;i++)names[i]=choices.get(i).label();
  new AlertDialog.Builder(activity).setTitle("Elige SOLO la impresora ESC/POS").setItems(names,(dialog,index)->{
   Candidate candidate=choices.get(index);
   String compatibility=candidate.iface.getInterfaceClass()==7?"\nAl conectar, autorizas liberar el controlador USB del sistema si bloquea esta impresora. Confirma solo cuando nadie esté imprimiendo. No borra datos.":"";
   new AlertDialog.Builder(activity).setTitle("Confirmar impresora").setMessage(candidate.label()+"\nUn endpoint OUT no demuestra que sea impresora. Confirma solo si corresponde a la impresora de caja."+compatibility)
    .setNegativeButton("Cancelar",null).setPositiveButton("Es la impresora",(d,w)->{if(!disposed){candidate.kernelDetachApproved=candidate.iface.getInterfaceClass()==7;preferences.edit().putString("selected",candidate.key()).putBoolean("kernelDetachApproved",candidate.kernelDetachApproved).apply();selected=candidate;observer.accept("Impresora guardada: "+candidate.label()+"\nPulsa Conectar; seleccionar no envía datos.");}}).show();
  }).setNegativeButton("Cancelar",null).show();
 }
 void chooseDrawerPin(){
  new AlertDialog.Builder(activity).setTitle("Pin de gaveta (no abre al seleccionar)").setSingleChoiceItems(new String[]{"Pin 0 (normal)","Pin 1 (solo si el pin 0 no abrió)"},drawerPin,(d,index)->{drawerPin=index;preferences.edit().putInt("drawerPin",index).apply();observer.accept("Pin de gaveta guardado: "+index+". Usa Probar gaveta una vez y verifica el resultado.");d.dismiss();}).setNegativeButton("Cancelar",null).show();
 }
 private void restoreSelection(){
  if(present(selected))return;
  close();selected=null;
  List<Candidate> choices=candidates();List<String> keys=new ArrayList<>();
  for(Candidate c:choices)keys.add(c.key());
  int index=GeckoUsbSelection.unique(preferences.getString("selected",""),keys);
  if(index>=0){Candidate c=choices.get(index);c.kernelDetachApproved=c.iface.getInterfaceClass()==7&&preferences.getBoolean("kernelDetachApproved",false);selected=c;}
 }
 void reconnectSaved(){
  try{restoreSelection();Candidate c=selected;if(c!=null&&manager.hasPermission(c.device))connect();
   else observer.accept("USB pendiente. Pulsa Conectar impresora; si es la primera vez, Elegir USB. Pin de gaveta: "+drawerPin);
  }catch(Exception e){observer.accept("USB no conectado. Revisa la impresora y pulsa Conectar; no se enviaron comandos.");}
 }
 private boolean present(Candidate c){
  if(c==null||manager==null)return false;
  UsbDevice d=manager.getDeviceList().get(c.device.getDeviceName());
  return d!=null&&d.getDeviceId()==c.device.getDeviceId()&&d.getVendorId()==c.device.getVendorId()&&d.getProductId()==c.device.getProductId();
 }
 JSONObject status() throws JSONException {
  restoreSelection();
  Candidate c=selected;
  if(connection!=null&&(opened!=c||!present(opened)||!manager.hasPermission(opened.device)))close();
  JSONObject result=new JSONObject().put("supported",manager!=null).put("configured",c!=null).put("connected",connection!=null&&opened==c).put("transport","usb").put("simulated",false);
  if(c!=null)result.put("vendorId",c.device.getVendorId()).put("productId",c.device.getProductId()).put("productName",c.label());
  return result;
 }
 JSONObject connect() throws Exception {
  restoreSelection();
  Candidate c=selected;
  if(c==null)throw new IOException("Pulsa Elegir USB arriba y selecciona la impresora. "+inventory());
  if(!present(c)){close();throw new IOException("La impresora seleccionada está desconectada. Revisa alimentación y vuelve a Elegir USB.");}
  if(!manager.hasPermission(c.device)){
   close();
   PendingIntent permission=PendingIntent.getBroadcast(activity,c.device.getDeviceId(),new Intent(permissionAction).setPackage(activity.getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   manager.requestPermission(c.device,permission);
   throw new IOException("Permiso USB pendiente o denegado. Acepta el permiso y vuelve a pulsar Conectar; todavía no se envió nada.");
  }
  if(connection!=null&&opened==c)return status();
  close();UsbDeviceConnection next=manager.openDevice(c.device);
  if(next==null)throw new IOException("No se pudo abrir USB. Cierra RawBT/HIOPOS y verifica el permiso.");
  boolean claimed=false;
  try{
   int mode=GeckoUsbClaim.claim(c.iface.getInterfaceClass(),c.kernelDetachApproved,force->next.claimInterface(c.iface,force));
   claimed=mode!=0;
   if(!claimed)throw new IOException("No se pudo reclamar la interfaz USB "+c.iface.getId()+". "+(c.kernelDetachApproved?"Fallaron el modo normal y la compatibilidad con el controlador del sistema.":"Falló el modo normal; no se autorizó liberar el controlador.")+" No se enviaron comandos. No desinstales aplicaciones.");
   if(c.iface.getAlternateSetting()!=0&&!next.setInterface(c.iface))throw new IOException("No se pudo seleccionar la interfaz USB.");
   connection=next;opened=c;observer.accept("USB conectado: "+c.label()+"\nReclamación: "+(mode==2?"compatibilidad con controlador del sistema":"normal")+". No se enviaron comandos.");return status();
  }catch(Exception e){if(claimed)next.releaseInterface(c.iface);next.close();connection=null;opened=null;throw e;}
 }
 JSONObject send(byte[] bytes) throws Exception {
  // Connect once BEFORE the first byte of a new request. Never replay a failed send.
  if(!status().getBoolean("connected"))connect();
  final long deadline=System.nanoTime()+4000000000L;
  try{
   PrinterCore.write(bytes,(data,offset,count)->{
    if(System.nanoTime()>deadline)throw new IOException("Tiempo USB agotado; resultado incierto. Comprueba papel/gaveta antes de repetir. No vuelvas a cobrar.");
    return connection.bulkTransfer(opened.endpoint,data,offset,count,500);
   });
   observer.accept("USB aceptó los bytes: "+opened.label()+"\nComprueba el resultado físico; no hay reintento automático.");
   return new JSONObject().put("accepted",true).put("transport","usb").put("physicalConfirmed",false);
  }catch(Exception e){close();throw e;}
 }
 byte[] drawer(){return GeckoUsbCommands.drawer(drawerPin);}
 void close(){if(connection!=null){try{connection.releaseInterface(opened.iface);}finally{connection.close();connection=null;opened=null;}}}
 void disposeUi(){disposed=true;activity.unregisterReceiver(permissionReceiver);}
}
