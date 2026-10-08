package hn.chingadazo.pos;
import android.app.*;
import android.os.*;
import android.content.*;
import android.hardware.usb.*;
import android.widget.*;
import android.graphics.Color;
import java.util.ArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** Native-only hardware probe. USB permission follows Android USB host documentation:
 * https://developer.android.com/develop/connectivity/usb/host */
public final class UsbTestActivity extends Activity {
 private static final String PERMISSION="hn.chingadazo.usbtest.USB_PERMISSION";
 private UsbManager manager; private UsbPrinter printer; private TextView status;
 private final ArrayList<Button> buttons=new ArrayList<>();
 private final Handler ui=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private boolean busy=false,waiting=false; private volatile boolean destroyed=false;
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent i){
  if(!PERMISSION.equals(i.getAction())||!waiting)return;
  waiting=false;enable(true);inspect(); // No command is sent as a side effect of permission.
 }};
 @Override public void onCreate(Bundle state){
  super.onCreate(state);manager=(UsbManager)getSystemService(USB_SERVICE);printer=new UsbPrinter(manager);
  if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,new IntentFilter(PERMISSION),Context.RECEIVER_NOT_EXPORTED);
  else registerReceiver(receiver,new IntentFilter(PERMISSION));
  ScrollView scroll=new ScrollView(this);LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(24),dp(16),dp(24),dp(16));scroll.addView(body);setContentView(scroll);
  TextView title=new TextView(this);title.setText("CHINGADAZO · PRUEBA USB 1.0.0");title.setTextSize(24);title.setTextColor(Color.BLACK);body.addView(title);
  TextView help=new TextView(this);help.setText("Sin ventas, Internet ni WebView. Cierra RawBT/HIOPOS antes de probar.\n1. Conecta USB y acepta el permiso.\n2. Prueba cada botón una sola vez y comprueba el resultado físico.\nLa gaveta debe estar conectada a la impresora. No hay reintentos automáticos.");help.setTextSize(18);body.addView(help);
  add(body,"Conectar / comprobar USB",()->connect());
  add(body,"1 · Imprimir prueba (sin corte)",()->send("print"));
  add(body,"2 · Cortar papel",()->send("cut"));
  add(body,"3 · Abrir gaveta",()->send("drawer"));
  status=new TextView(this);status.setTextSize(18);status.setTextColor(Color.BLACK);status.setPadding(0,dp(16),0,0);body.addView(status);inspect();
 }
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private void add(LinearLayout body,String label,Runnable action){Button b=new Button(this);b.setText(label);b.setTextSize(18);b.setMinHeight(dp(56));b.setOnClickListener(v->action.run());body.addView(b,new LinearLayout.LayoutParams(-1,-2));buttons.add(b);}
 private void enable(boolean value){for(Button b:buttons)b.setEnabled(value);}
 private void inspect(){
  try{UsbDevice d=printer.device();status.setText(d==null?"No aparece USB Printer P (8137:8214). Revisa cable y alimentación.":"USB Printer P (8137:8214): "+(manager.hasPermission(d)?"autorizada. Puedes probar los botones.":"detectada. Pulsa Conectar y acepta el permiso."));}
  catch(Exception e){status.setText(e.getMessage());}
 }
 private void connect(){
  if(busy||waiting)return;
  try{UsbDevice d=printer.device();if(d==null||manager.hasPermission(d)){inspect();return;}
   waiting=true;enable(false);status.setText("Acepta el permiso USB. Después pulsa la prueba que desees.");
   manager.requestPermission(d,PendingIntent.getBroadcast(this,0,new Intent(PERMISSION).setPackage(getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   ui.postDelayed(()->{if(!destroyed&&waiting){waiting=false;enable(true);inspect();}},30000);
  }catch(Exception e){waiting=false;enable(true);status.setText(e.getMessage());}
 }
 private void send(String action){
  if(busy||waiting)return;
  try{UsbDevice d=printer.device();if(d==null||!manager.hasPermission(d)){inspect();return;}}catch(Exception e){status.setText(e.getMessage());return;}
  busy=true;enable(false);status.setText("Enviando "+action+"… No vuelvas a pulsar ni cierres la aplicación.");
  worker.execute(()->{
   String result;
   try{if(destroyed)return;printer.send(UsbTestCommands.bytes(action));result="Comando enviado por USB: "+action+". Esto NO confirma el resultado físico: comprueba papel/corte/gaveta antes de repetir.";}
   catch(Exception e){result="No se confirmó el envío: "+e.getMessage()+"\nNo se reintentará. Comprueba el resultado físico antes de volver a pulsar.";}
   final String message=result;ui.post(()->{if(!destroyed){busy=false;enable(true);status.setText(message);}});
  });
 }
 @Override public void onBackPressed(){if(busy||waiting)status.setText("Espera a que termine la operación USB antes de salir.");else super.onBackPressed();}
 @Override protected void onDestroy(){destroyed=true;ui.removeCallbacksAndMessages(null);worker.shutdownNow();unregisterReceiver(receiver);super.onDestroy();}
}
