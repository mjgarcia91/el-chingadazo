package hn.chingadazo.pos;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Deliberately separate access pilot; no sales controls or WebView. */
public class NativeAccessActivity extends Activity {
    private static final ExecutorService WORKER=Executors.newSingleThreadExecutor();
    private static NativeAccess access;
    protected final NativeAccess nativeAccess(){return access;}
    private LinearLayout content,adminFields;
    private ScrollView accessRoot;
    private TextView status,identity;
    private EditText email,password,pin;
    private Button authorize,login,restore,logout,forget,adminToggle;
    private final NativeScreenState screen=new NativeScreenState();
    private interface Work { NativeAccess.Profile run() throws IOException; }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if(access==null) access=new NativeAccess(new NativeHttp(),new NativeVault(getApplicationContext()),System::currentTimeMillis);
        ScrollView scroll=new ScrollView(this); scroll.setFillViewport(true); accessRoot=scroll;
        content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(24),dp(16),dp(24),dp(24)); content.setBackgroundColor(0xff12130f);
        scroll.addView(content); setContentView(scroll);
        text(content,"EL CHINGADAZO · ACCESO NATIVO 0.1.1",24,0xffffce24);
        text(content,"PILOTO SIN VENTAS — No permite facturar todavía.\nNo reemplaza la caja actual ni utiliza WebView o RawBT.",17,0xffffffff);
        status=text(content,"Comprobando sesión…",18,0xffffce24);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        identity=text(content,"",20,0xffffffff);
        pin=field(content,"PIN del personal (6 números)",InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_VARIATION_PASSWORD,6);
        login=button(content,"Entrar con PIN",v->enterPin());
        restore=button(content,"Comprobar conexión / recuperar sesión",v->submit(access::restore,"Comprobando acceso con el servidor…"));
        logout=button(content,"Cambiar usuario / cerrar sesión",v->submit(()->{access.logout(false);return null;},"Cerrando sesión…"));
        adminToggle=button(content,"Primera vez: autorizar este equipo",v->{
            adminFields.setVisibility(adminFields.getVisibility()==View.VISIBLE ? View.GONE : View.VISIBLE);
            password.setText("");
        });
        adminFields=new LinearLayout(this); adminFields.setOrientation(LinearLayout.VERTICAL); content.addView(adminFields);
        email=field(adminFields,"Correo del administrador",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,254);
        password=field(adminFields,"Contraseña del administrador",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD,4096);
        authorize=button(adminFields,"Autorizar equipo",v->{
            final String e=email.getText().toString().trim(),p=password.getText().toString();
            password.setText("");
            submit(()->access.authorize(e,p),"Verificando administrador y autorización…");
        });
        adminFields.setVisibility(View.GONE);
        forget=button(content,"Retirar autorización de este piloto",v->new AlertDialog.Builder(this)
            .setTitle("Retirar autorización")
            .setMessage("Cierra la sesión y retira el permiso guardado en esta APK de prueba. Tendrás que autorizarla otra vez. No cambia ventas ni otras aplicaciones.")
            .setNegativeButton("Cancelar",null)
            .setPositiveButton("Retirar",(dialog,which)->submit(()->{access.logout(true);return null;},"Retirando autorización local…")).show());
        text(content,"Usa el correo y contraseña de administrador del sistema, no tu cuenta de Play Store. No compartas contraseñas ni PIN por chat.",16,0xffdddddd);
    }
    private void enterPin() {
        final String value=pin.getText().toString(); pin.setText("");
        submit(()->access.login(value),"Verificando PIN…");
    }
    @Override protected void onStart() {
        super.onStart(); screen.start();
        setContentView(accessRoot);
        submit(access::restore,"Comprobando sesión con el servidor…");
    }
    @Override protected void onStop() {
        screen.stop(); access.cancel(); clearSecrets();
        identity.setText(""); super.onStop();
    }
    private void submit(Work work,String message) {
        final long ticket=screen.begin();
        if(ticket<0) return;
        controls(false); clearSecrets(); identity.setText(""); status.setText(message);
        WORKER.execute(()->{
            if(!screen.current(ticket)) return;
            NativeAccess.Profile result=null; String failure=null;
            try { result=work.run(); }
            catch(NativeAccess.Failure e) { failure=e.getMessage(); }
            catch(javax.net.ssl.SSLException e) { failure="No se pudo validar la conexión segura. Revisa fecha/hora y certificados del equipo; no desactives la seguridad."; }
            catch(java.net.SocketTimeoutException e) { failure="El servidor tardó demasiado. Revisa Internet y vuelve a comprobar. No se confirmó el acceso."; }
            catch(IOException e) {
                String safe=e.getMessage();
                failure=safe!=null && safe.startsWith("No se pudo ") && safe.contains("sesión protegida") ? safe :
                    "No se pudo confirmar el acceso. Revisa Internet. Si continúa, informa este mensaje; no borres datos.";
            }
            catch(RuntimeException e) { failure="No se pudo completar el acceso en este equipo. Solicita revisión; no borres datos."; }
            final NativeAccess.Profile profile=result; final String error=failure;
            runOnUiThread(()->{
                if(!screen.finish(ticket)) return;
                controls(true);
                if(error!=null) { status.setText(error); return; }
                if(profile==null) {
                    status.setText("Sin sesión. Introduce tu PIN. Si es la primera vez, autoriza este equipo.");
                    pin.requestFocus();
                } else {
                    status.setText("ACCESO VERIFICADO — conexión con tu sistema confirmada.");
                    String role=profile.role.equals("admin") ? "Administración" : profile.role.equals("cashier") ? "Caja" : "Cocina";
                    identity.setText(profile.name+" · "+role+"\nEste piloto no permite facturar. La caja completa está pendiente.");
                    adminFields.setVisibility(View.GONE);
                    verified(profile);
                }
            });
        });
    }
    private void clearSecrets() { if(pin!=null) pin.setText(""); if(password!=null) password.setText(""); }
    protected void verified(NativeAccess.Profile profile) { /* Access pilot stays on its verification screen. */ }
    protected void showAccessAndLogout() {
        setContentView(accessRoot);
        submit(()->{access.logout(false);return null;},"Cerrando sesión…");
    }
    private void controls(boolean enabled) {
        for(View view:new View[]{authorize,login,restore,logout,forget,adminToggle,email,password,pin})
            if(view!=null) view.setEnabled(enabled);
    }
    private TextView text(LinearLayout parent,String value,int size,int color) {
        TextView view=new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        view.setPadding(0,dp(8),0,dp(8)); parent.addView(view); return view;
    }
    private EditText field(LinearLayout parent,String label,int type,int max) {
        TextView caption=text(parent,label,16,0xffffffff);
        EditText view=new EditText(this); view.setId(View.generateViewId()); caption.setLabelFor(view.getId());
        view.setInputType(type); view.setSingleLine(true); view.setTextSize(20); view.setMinHeight(dp(56));
        view.setTextColor(0xff111111); view.setBackgroundColor(0xffeeeeee); view.setPadding(dp(12),dp(8),dp(12),dp(8));
        view.setFilters(new InputFilter[]{new InputFilter.LengthFilter(max)});
        view.setSaveEnabled(false); view.setLongClickable(false);
        if(android.os.Build.VERSION.SDK_INT>=26) view.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        parent.addView(view); return view;
    }
    private Button button(LinearLayout parent,String title,View.OnClickListener listener) {
        Button view=new Button(this); view.setText(title); view.setTextSize(17); view.setAllCaps(false);
        view.setMinHeight(dp(56)); view.setOnClickListener(listener);
        LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,-2); layout.topMargin=dp(8);
        parent.addView(view,layout); return view;
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
}
