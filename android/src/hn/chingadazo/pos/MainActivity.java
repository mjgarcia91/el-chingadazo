package hn.chingadazo.pos;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.hardware.usb.*;
import android.net.Uri;
import android.webkit.*;
import android.widget.*;
import android.view.*;
import org.json.*;
import java.util.concurrent.*;
import java.util.regex.*;

public final class MainActivity extends Activity {
 private static final String HOME=PrinterCore.ORIGIN+"/personal", PERMISSION="hn.chingadazo.pos.USB_PERMISSION";
 private WebView web; private LinearLayout layout; private boolean blocked=false; private UsbManager manager; private UsbPrinter printer; private WebMessagePort port;
 private String originalUserAgent="No disponible";
 private final Handler ui=new Handler(Looper.getMainLooper());
 private final ThreadPoolExecutor jobs=new ThreadPoolExecutor(1,1,0L,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<Runnable>(8));
 private volatile int generation=0; private volatile boolean destroyed=false;
 private int activeJobs=0; private String permissionId; private WebMessagePort permissionPort; private int permissionGeneration;
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent i){
  if(!PERMISSION.equals(i.getAction())||permissionId==null)return;
  String id=permissionId;WebMessagePort p=permissionPort;int g=permissionGeneration;permissionId=null;
  try{UsbDevice d=printer.device();if(d==null||!manager.hasPermission(d))throw new Exception("Permiso USB no concedido.");reply(p,g,id,status(),null);}
  catch(Exception e){reply(p,g,id,null,e.getMessage());}
 }};
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  manager=(UsbManager)getSystemService(USB_SERVICE);printer=new UsbPrinter(manager);
  if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,new IntentFilter(PERMISSION),Context.RECEIVER_NOT_EXPORTED);else registerReceiver(receiver,new IntentFilter(PERMISSION));
  layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(Color.rgb(23,23,23));
  LinearLayout bar=new LinearLayout(this);TextView title=new TextView(this);title.setText("  EL CHINGADAZO · CAJA");title.setTextColor(Color.rgb(255,218,36));title.setGravity(Gravity.CENTER_VERTICAL);
  bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));Button usb=new Button(this);usb.setText("USB");usb.setContentDescription("Estado de impresora USB");usb.setTextSize(12);bar.addView(usb,new LinearLayout.LayoutParams(dp(88),dp(48)));
  Button diagnostic=new Button(this);diagnostic.setText("Diagnóstico");diagnostic.setTextSize(12);bar.addView(diagnostic,new LinearLayout.LayoutParams(dp(128),dp(48)));diagnostic.setOnClickListener(v->showDiagnostics());
  usb.setOnClickListener(v->{try{JSONObject s=status();notice("Impresora USB",s.optBoolean("connected")?"Conectada y autorizada. Usa Imprimir prueba en Caja para verificar papel y corte.":"En Caja, pulsa Conectar impresora y acepta el permiso de Android. Revisa el cable si no aparece USB Printer P.");}catch(Exception e){notice("USB",e.getMessage());}});
  layout.addView(bar);web=new WebView(this);web.setVisibility(View.INVISIBLE);layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
  WebSettings s=web.getSettings();String ua=s.getUserAgentString();Matcher m=Pattern.compile("Chrome/(\\d+)").matcher(ua);
  originalUserAgent=ua;
  if(!m.find()||Integer.parseInt(m.group(1))<100){blockCash("Esta APK necesita Android System WebView 100 o superior. No basta con actualizar Firefox. Consulta las actualizaciones disponibles en Google Play o al proveedor. No se ha cambiado ninguna venta.");return;}
  s.setUserAgentString(ua+" ChingadazoPOS/1");s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  s.setSupportMultipleWindows(true);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setMediaPlaybackRequiresUserGesture(false);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(false);
  // No addJavascriptInterface: deliver an unguessable message port only to the trusted top document.
  // https://developer.android.com/reference/android/webkit/WebView#postWebMessage(android.webkit.WebMessage,android.net.Uri)
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,String url){return block(url);}
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return r.isForMainFrame()&&block(r.getUrl().toString());}
   @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){closePort();if(!PrinterCore.trusted(url)){v.stopLoading();notice("Navegación bloqueada","La caja solo abre su sitio de Personal.");}}
   @Override public void onPageFinished(WebView v,String url){
    if(blocked||!PrinterCore.trusted(url)||!url.equals(v.getUrl()))return;
    final int g=generation;
    v.evaluateJavascript("Boolean(window.ChingadazoNative&&typeof structuredClone==='function'&&navigator.locks&&crypto.randomUUID)",value->{
     if(g!=generation||destroyed)return;
     if(!"true".equals(value)){blockCash("El motor web o la página no tienen las funciones necesarias para caja. Comprueba la actualización del sitio y de Android System WebView antes de usar esta APK.");return;}
     bind(g);
    });
   }
   @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())notice("Sin conexión","No se pudo cargar Caja. Comprueba Internet y vuelve a abrir la aplicación. No borres los datos de la aplicación si hay consumos pendientes.");}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result){if(!PrinterCore.trusted(url)){result.cancel();return true;}new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Aceptar",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result){if(!PrinterCore.trusted(url)){result.cancel();return true;}new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Aceptar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsPrompt(WebView v,String url,String message,String value,JsPromptResult result){if(!PrinterCore.trusted(url)){result.cancel();return true;}EditText input=new EditText(MainActivity.this);input.setText(value);new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input).setPositiveButton("Aceptar",(d,w)->result.confirm(input.getText().toString())).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onCreateWindow(WebView v,boolean dialog,boolean gesture,Message msg){notice("Vista externa no disponible","Esta versión de Caja no abre WhatsApp ni documentos en aplicaciones externas. La venta no se ha repetido.");return false;}
  });
  web.loadUrl(HOME);
 }
 private boolean block(String url){if(PrinterCore.trusted(url))return false;notice("Navegación bloqueada","Esta aplicación solo permite el sitio de El Chingadazo.");return true;}
 private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
 private String packageVersion(String name){
  try{return name+": "+getPackageManager().getPackageInfo(name,0).versionName;}
  catch(android.content.pm.PackageManager.NameNotFoundException e){return name+": no encontrado o no visible";}
 }
 private void showDiagnostics(){
  if(destroyed||isFinishing())return;
  TextView text=new TextView(this);text.setTextSize(18);text.setTextColor(Color.BLACK);text.setPadding(dp(16),dp(12),dp(16),dp(12));text.setTextIsSelectable(true);
  text.setText(WebViewDiagnostics.report(packageVersion(getPackageName()),Build.VERSION.RELEASE+" / API "+Build.VERSION.SDK_INT,Build.MODEL,originalUserAgent,packageVersion("com.android.webview"),packageVersion("com.google.android.webview")));
  ScrollView scroll=new ScrollView(this);scroll.addView(text);
  new AlertDialog.Builder(this).setTitle("Diagnóstico WebView").setView(scroll).setPositiveButton("Cerrar",null).show();
 }
 private void notice(String title,String message){if(!destroyed&&!isFinishing())new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("Aceptar",null).show();}
 private void blockCash(String message){
  if(blocked)return;blocked=true;closePort();web.stopLoading();web.setVisibility(View.GONE);
  TextView explanation=new TextView(this);explanation.setText("CAJA NO DISPONIBLE\n\n"+message+"\n\nNo desinstales ni borres datos si tienes consumos pendientes. Tras resolverlo, vuelve a abrir la aplicación.");explanation.setTextColor(Color.WHITE);explanation.setTextSize(20);explanation.setPadding(32,32,32,32);layout.addView(explanation);
 }
 private void closePort(){generation++;if(port!=null){port.close();port=null;}}
 private JSONObject status() throws Exception {
  UsbDevice d=printer.device();boolean connected=d!=null&&manager.hasPermission(d);
  return new JSONObject().put("supported",true).put("configured",true).put("connected",connected).put("transport","native").put("name","USB Printer P").put("productName","USB Printer P");
 }
 private void bind(final int g){
  if(port!=null)return;WebMessagePort[] pair=web.createWebMessageChannel();port=pair[0];final WebMessagePort current=port;
  current.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort p,WebMessage message){
   if(g!=generation||destroyed||!PrinterCore.trusted(web.getUrl()))return;
   String id="";
   try{
    String data=message.getData();if(data==null||data.length()>65000)throw new Exception("Mensaje demasiado grande.");JSONObject request=new JSONObject(data);
    id=request.getString("id");if(!id.matches("[a-zA-Z0-9_-]{1,64}"))throw new Exception("Identificador inválido.");String action=request.getString("action");
    if("status".equals(action)){reply(p,g,id,status(),null);return;}
    if("connect".equals(action)){connect(p,g,id);return;}
    byte[] bytes;
    if("print".equals(action))bytes=PrinterCore.ticket(request.getString("text"));
    else if("drawer".equals(action))bytes=PrinterCore.drawer();else throw new Exception("Acción no permitida.");
    if(activeJobs>0)throw new Exception("Hay un envío USB en curso. Espera antes de iniciar otro.");
    final String jobId=id;activeJobs++;
    try{jobs.execute(()->{
     try{if(destroyed||g!=generation)throw new Exception("Página cerrada antes de enviar. No se envió el trabajo pendiente.");printer.send(bytes);reply(p,g,jobId,new JSONObject().put("accepted",true),null);}
     catch(Exception e){reply(p,g,jobId,null,e.getMessage());}
     finally{ui.post(()->activeJobs--);}
    });}catch(RejectedExecutionException e){activeJobs--;throw new Exception("Impresora ocupada: demasiados trabajos pendientes.");}
   }catch(Exception e){reply(p,g,id,null,e.getMessage());}
  }});
  final String nonce=java.util.UUID.randomUUID().toString().replace("-","");
  web.evaluateJavascript("window.ChingadazoNative.prepare("+JSONObject.quote(nonce)+")",value->{
   if(destroyed||g!=generation){pair[1].close();return;}
   if(!"true".equals(value)){pair[1].close();blockCash("No se pudo autenticar el canal USB. Cierra y vuelve a abrir la aplicación.");return;}
   web.postWebMessage(new WebMessage("chingadazo-native-v1:"+nonce,new WebMessagePort[]{pair[1]}),Uri.parse(PrinterCore.ORIGIN));web.setVisibility(View.VISIBLE);
  });
 }
 private void connect(WebMessagePort p,int g,String id) throws Exception {
  UsbDevice d=printer.device();if(d==null)throw new Exception("No aparece USB Printer P. Revisa cable USB y alimentación.");
  if(manager.hasPermission(d)){reply(p,g,id,status(),null);return;}
  if(permissionId!=null)throw new Exception("Hay una autorización USB pendiente.");
  permissionId=id;permissionPort=p;permissionGeneration=g;
  PendingIntent intent=PendingIntent.getBroadcast(this,0,new Intent(PERMISSION).setPackage(getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  try{manager.requestPermission(d,intent);}catch(Exception e){permissionId=null;throw e;}
  ui.postDelayed(()->{if(id.equals(permissionId)&&p==permissionPort){permissionId=null;reply(p,g,id,null,"Permiso USB pendiente. Comprueba el diálogo de Android y vuelve a Conectar.");}},30000);
 }
 private void reply(WebMessagePort p,int g,String id,JSONObject result,String error){ui.post(()->{
  if(destroyed||g!=generation||p!=port)return;
  try{JSONObject message=new JSONObject().put("id",id);if(error==null)message.put("result",result);else message.put("error",error);p.postMessage(new WebMessage(message.toString()));}catch(Exception ignored){}
 });}
 @Override public void onBackPressed(){notice("Caja abierta","Usa los botones Volver del sistema. Para salir, usa Inicio de Android. No cierres ni recargues durante un cobro o envío USB.");}
 @Override protected void onDestroy(){destroyed=true;closePort();jobs.shutdownNow();unregisterReceiver(receiver);if(web!=null)web.destroy();super.onDestroy();}
}
