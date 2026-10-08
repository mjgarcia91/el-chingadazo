package hn.chingadazo.pos;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.widget.*;
import org.mozilla.geckoview.*;
import java.util.concurrent.atomic.AtomicBoolean;
/** Isolated internal shell. Opens the existing web, never a replacement native UI. */
public final class GeckoEvaluationActivity extends Activity {
 private static GeckoRuntime runtime;
 private GeckoSession session;
 private GeckoUsbDelegate bridge;
 private GeckoUsbTransport usb;
 private TextView warning;
 private AlertDialog activeAlert;
 private static final String BANNER="EL CHINGADAZO · USB 1.0.0";
 private boolean destroyed,foreground;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(1);
  warning=new TextView(this);warning.setText(BANNER+"\nPreparando conexión USB…");warning.setTextColor(0xff111111);warning.setBackgroundColor(0xffffcc33);warning.setPadding(12,6,12,6);layout.addView(warning);
  usb=new GeckoUsbTransport(this,this::showBridgeStatus);
  LinearLayout hardware=new LinearLayout(this);
  Button choose=new Button(this);choose.setText("Elegir USB");choose.setOnClickListener(v->usb.choose());hardware.addView(choose);
  Button cut=new Button(this);cut.setText("Cortar prueba");cut.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("Corte físico de prueba").setMessage("¿Cortar una vez? Comprueba primero que la impresora seleccionada es la correcta.").setNegativeButton("Cancelar",null).setPositiveButton("Cortar",(d,w)->{if(bridge!=null)bridge.cutTest();}).show());hardware.addView(cut);
  Button pin=new Button(this);pin.setText("Pin de gaveta");pin.setOnClickListener(v->usb.chooseDrawerPin());hardware.addView(pin);layout.addView(hardware);
  GeckoView view=new GeckoView(this);layout.addView(view,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
  if(runtime==null)runtime=GeckoRuntime.create(getApplicationContext(),new GeckoRuntimeSettings.Builder().remoteDebuggingEnabled(false).build());
  session=new GeckoSession();
  session.setPromptDelegate(new GeckoSession.PromptDelegate(){
   @Override public GeckoResult<PromptResponse> onTextPrompt(GeckoSession s,TextPrompt prompt){
    if(prompt.isComplete())return GeckoResult.fromValue(null);
    if(destroyed||s!=session||prompt.message!=null&&prompt.message.length()>8192||prompt.defaultValue!=null&&prompt.defaultValue.length()>4096)return GeckoResult.fromValue(prompt.dismiss());
    if(activeAlert!=null)activeAlert.dismiss();
    GeckoResult<PromptResponse> result=new GeckoResult<>();
    GeckoPromptDecision<String> decision=new GeckoPromptDecision<>(value->{
     if(prompt.isComplete())result.complete(null);
     else result.complete(value==null?prompt.dismiss():prompt.confirm(value));
    });
    EditText input=new EditText(GeckoEvaluationActivity.this);
    input.setSingleLine(true);input.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(4096)});
    input.setText(prompt.defaultValue==null?"":prompt.defaultValue);input.selectAll();
    final AlertDialog dialog=new AlertDialog.Builder(GeckoEvaluationActivity.this)
      .setTitle("El Chingadazo · ingresar dato").setMessage(prompt.message).setView(input)
      .setPositiveButton("Aceptar",(d,w)->decision.finish(input.getText().toString()))
      .setNegativeButton("Cancelar",(d,w)->decision.finish(null)).create();
    activeAlert=dialog;
    dialog.setOnDismissListener(d->{if(activeAlert==dialog)activeAlert=null;decision.finish(null);});
    prompt.setDelegate(new PromptInstanceDelegate(){
     @Override public void onPromptDismiss(BasePrompt p){decision.finish(null);dialog.dismiss();}
    });
    try{dialog.show();input.requestFocus();dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);}
    catch(RuntimeException error){dialog.dismiss();decision.finish(null);showBridgeStatus("No se pudo mostrar el formulario. Acción cancelada.");}
    return result;
   }
   @Override public GeckoResult<PromptResponse> onButtonPrompt(GeckoSession s,ButtonPrompt prompt){
    if(prompt.isComplete())return GeckoResult.fromValue(null);
    if(destroyed||s!=session||prompt.message!=null&&prompt.message.length()>8192)return GeckoResult.fromValue(prompt.dismiss());
    if(activeAlert!=null)activeAlert.dismiss();
    GeckoResult<PromptResponse> result=new GeckoResult<>();
    GeckoPromptDecision<Boolean> decision=new GeckoPromptDecision<>(accepted->{
     if(accepted==null||prompt.isComplete())result.complete(null);
     else result.complete(prompt.confirm(accepted?ButtonPrompt.Type.POSITIVE:ButtonPrompt.Type.NEGATIVE));
    });
    final AlertDialog dialog=new AlertDialog.Builder(GeckoEvaluationActivity.this)
      .setTitle("El Chingadazo · confirmar")
      .setMessage(prompt.message==null?"¿Confirmar la acción solicitada?":prompt.message)
      .setPositiveButton("Aceptar",(d,w)->decision.finish(true))
      .setNegativeButton("Cancelar",(d,w)->decision.finish(false)).create();
    activeAlert=dialog;
    dialog.setOnDismissListener(d->{if(activeAlert==dialog)activeAlert=null;decision.finish(false);});
    prompt.setDelegate(new PromptInstanceDelegate(){
     @Override public void onPromptDismiss(BasePrompt p){decision.finish(null);dialog.dismiss();}
    });
    try{dialog.show();}catch(RuntimeException error){dialog.dismiss();decision.finish(false);showBridgeStatus("No se pudo mostrar la confirmación. Acción cancelada.");}
    return result;
   }
   @Override public GeckoResult<PromptResponse> onAlertPrompt(GeckoSession s,AlertPrompt prompt){
    if(destroyed||s!=session)return GeckoResult.fromValue(prompt.dismiss());
    if(activeAlert!=null)activeAlert.dismiss();
    GeckoResult<PromptResponse> result=new GeckoResult<>();
    AtomicBoolean resolved=new AtomicBoolean();
    Runnable finish=()->{if(resolved.compareAndSet(false,true))result.complete(prompt.isComplete()?null:prompt.dismiss());};
    String message=prompt.message==null?"Aviso sin texto.":prompt.message;
    if(message.length()>8192)message=message.substring(0,8192)+"\n[Aviso recortado]";
    final AlertDialog dialog=new AlertDialog.Builder(GeckoEvaluationActivity.this)
      .setTitle("El Chingadazo · aviso de la web")
      .setMessage(message).setPositiveButton("Cerrar",(d,which)->d.dismiss()).create();
    activeAlert=dialog;
    dialog.setOnDismissListener(d->{if(activeAlert==dialog)activeAlert=null;finish.run();});
    prompt.setDelegate(new PromptInstanceDelegate(){
     @Override public void onPromptDismiss(BasePrompt p){
      // Gecko already cancelled this prompt (e.g. navigation); never resolve it twice.
      if(resolved.compareAndSet(false,true))result.complete(null);
      dialog.dismiss();
     }
    });
    try{dialog.show();}catch(RuntimeException error){dialog.dismiss();finish.run();showBridgeStatus("No se pudo mostrar el aviso web.");}
    return result;
   }
  });
  session.setNavigationDelegate(new GeckoSession.NavigationDelegate(){
   @Override public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s,LoadRequest request){return GeckoResult.fromValue(PrinterCore.trusted(request.uri)?AllowOrDeny.ALLOW:AllowOrDeny.DENY);}
   @Override public GeckoResult<AllowOrDeny> onSubframeLoadRequest(GeckoSession s,LoadRequest request){return GeckoResult.fromValue(AllowOrDeny.DENY);}
   @Override public GeckoResult<GeckoSession> onNewSession(GeckoSession s,String uri){return GeckoResult.fromValue(null);}
  });
  session.open(runtime);view.setSession(session);
  runtime.getWebExtensionController().ensureBuiltIn("resource://android/assets/messaging/",GeckoPolicy.EXTENSION).accept(extension->{
   if(destroyed)return;
   bridge=new GeckoUsbDelegate(extension,usb,this::showBridgeStatus);extension.setMessageDelegate(bridge,GeckoPolicy.NATIVE_APP);if(foreground)bridge.resume();else bridge.suspend();
   session.getUserAgent().accept(ua->{if(!destroyed){session.getSettings().setUserAgentOverride(ua+" ChingadazoPOS/1");session.loadUri(PrinterCore.ORIGIN+"/personal");}},error->warning.setText("No se pudo preparar el motor. Caja no abierta."));
  },error->warning.setText("No se pudo preparar el puente. Caja no abierta."));
 }
 private void showBridgeStatus(String status){runOnUiThread(()->{if(!destroyed)warning.setText(BANNER+"\n"+status);});}
 @Override protected void onResume(){super.onResume();foreground=true;if(bridge!=null)bridge.resume();}
 @Override protected void onStop(){foreground=false;if(activeAlert!=null)activeAlert.dismiss();if(bridge!=null)bridge.suspend();super.onStop();}
 @Override protected void onDestroy(){destroyed=true;if(activeAlert!=null)activeAlert.dismiss();if(bridge!=null)bridge.close();if(usb!=null)usb.disposeUi();if(session!=null)session.close();super.onDestroy();}
}
