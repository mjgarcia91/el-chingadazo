package hn.chingadazo.pos;
import android.app.Activity;
import android.view.View;
import android.widget.*;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;

/** Explicit payment screen: remote confirmation is separate from physical output. */
final class NativePaymentsView {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    final LinearLayout root;private final Activity activity;private final NativeAccess access;
    private final String owner,tableId;private final Runnable back;private final NativePaymentService service;private final NativeUsb usb;
    private final NativeScreenState screen=new NativeScreenState();private NativeTables state;private NativeCheckout.Intent pending;
    private Map<String,Map<String,Integer>> jobs=Collections.emptyMap();private boolean busy=true;private String message="Consultando cobros…";
    private Spinner method;private EditText received;
    private final NativeDrafts counterDrafts;private final NativeCounterCheckout counter;private NativeDrafts.Draft cart;
    NativePaymentsView(Activity activity,NativeAccess access,NativeAccess.Profile profile,String tableId,Runnable back)throws IOException{
        this.activity=activity;this.access=access;this.owner=profile.id;this.tableId=tableId;this.back=back;usb=NativeUsb.get(activity);
        service=new NativePaymentService(access,owner,new NativeDraftStore(activity,"payments"),new NativeDraftStore(activity,true),System::currentTimeMillis);
        counterDrafts=new NativeDrafts(new NativeDraftContexts(new NativeDraftStore(activity),"counter"));
        counter=new NativeCounterCheckout(counterDrafts,new NativeCounterCheckout.Gateway(){
            public Map<String,Object> read(String id)throws IOException{return access.order(owner,id);}
            public void send(Map<String,Object> body)throws IOException{access.counter(owner,body);}
        });
        root=column();root.setBackgroundColor(0xff12130f);root.setPadding(dp(16),dp(8),dp(16),dp(8));screen.start();
    }
    void stop(){screen.stop();root.removeAllViews();}
    void load(){work(null);}
    private interface Action {String run()throws IOException;}
    private void work(Action action){
        long epoch=screen.begin();if(epoch<0)return;busy=true;draw();
        IO.execute(()->{
            if(!screen.current(epoch))return;
            String result="Selecciona el pago. No se cobra al abrir esta pantalla.";NativeTables next=null;NativeCheckout.Intent saved=null;
            Map<String,Map<String,Integer>> effects=Collections.emptyMap();
            NativeDrafts.Draft recovered=null;
            try{if(action!=null)result=action.run();}catch(IOException e){result=e.getMessage();}
            try{recovered=counterDrafts.load(owner);saved=service.pending();
                Set<String> protectedIds=new HashSet<>();if(saved!=null)protectedIds.add(saved.expected.operation);if(recovered.payment!=null)protectedIds.add(recovered.payment.id);
                usb.effects.retireTransferred(owner,protectedIds);effects=usb.effects.list(owner);next=NativeTables.parse(access.dining(owner));}
            catch(IOException e){result+="\nNo se pudo actualizar el estado. Conserva el intento; no vuelvas a cobrar.";}
            final String text=result;final NativeTables snapshot=next;final NativeCheckout.Intent intent=saved;final Map<String,Map<String,Integer>> output=effects;
            final NativeDrafts.Draft restored=recovered;
            activity.runOnUiThread(()->{if(!screen.finish(epoch))return;cart=restored;state=snapshot;pending=intent;jobs=output;message=text;busy=false;draw();});
        });
    }
    private String complete(NativeCheckout.Intent paid)throws IOException{
        try{service.finish(usb.effects);}catch(IOException e){return "PAGO CONFIRMADO. Pendiente finalizar/liberar: "+e.getMessage();}
        try{usb.sendPending(owner,paid.expected.operation);return "PAGO CONFIRMADO. Mesa liberada. Envíos USB realizados; comprueba el resultado físico.";}
        catch(IOException e){return "PAGO CONFIRMADO. Mesa liberada. "+e.getMessage();}
    }
    private void pay(boolean print){
        if(busy||pending!=null||state==null||cart==null||cart.payment!=null)return;NativeTables.Account account=state.account(tableId);
        boolean counterSale="counter".equals(tableId);
        if(counterSale?(cart.pending!=null||cart.lines.isEmpty()):(account==null||!account.status.equals("open")))return;
        final long total=counterSale?NativeSales.total(cart.lines):account.total;
        final long cash;final String payment=method.getSelectedItem().toString();final long revision=counterSale?cart.revision:state.revision;
        try{cash=payment.equals("Efectivo")?new BigDecimal(received.getText().toString().trim().replace(',','.')).movePointRight(2).longValueExact():0;
            if(cash<0||(payment.equals("Efectivo")&&cash<total))throw new ArithmeticException();}
        catch(NumberFormatException|ArithmeticException e){message="Introduce efectivo suficiente con máximo dos decimales.";draw();return;}
        work(()->{
            if(counterSale){
                if(service.pending()!=null)throw new IOException("Recupera primero el cobro de mesa pendiente.");
                NativeShifts.Shift shift=NativeShifts.current(access.shifts(owner),owner,System.currentTimeMillis());
                if(shift==null)throw new IOException("Abre tu turno antes de cobrar.");
                return completeCounter(counter.start(owner,revision,shift.id,payment,cash,print,activity.getSharedPreferences("native-print",0).getBoolean("kitchen",false)));
            }
            // Do not silently omit products still saved locally for this occupation.
            NativeDrafts.Store disk=new NativeDraftStore(activity);
            for(String context:new String[]{"account-"+account.id,"table-"+tableId}){
                NativeDrafts.Draft draft=new NativeDrafts(new NativeDraftContexts(disk,context)).load(owner);
                if(!draft.lines.isEmpty()||draft.pending!=null)throw new IOException("Hay productos locales sin confirmar. Envíalos a la mesa antes de cobrar.");
            }
            return complete(service.table(tableId,account.id,revision,account.total,payment,cash,print));
        });
    }
    private String completeCounter(NativeDrafts.Draft paid)throws IOException{
        try{counter.finish(owner,usb.effects);}catch(IOException e){return "PAGO CONFIRMADO. Cuenta protegida; pendiente finalizar: "+e.getMessage();}
        try{usb.sendPending(owner,paid.payment.id);return "PAGO CONFIRMADO. Mostrador listo para otra cuenta. Comprueba el resultado físico.";}
        catch(IOException e){return "PAGO CONFIRMADO. Cuenta guardada; salida pendiente: "+e.getMessage();}
    }
    private void confirmPhysical(String operation,String effect){
        if(busy)return;
        new android.app.AlertDialog.Builder(activity).setTitle("Comprobar resultado físico")
            .setMessage("Confirma únicamente si alguien en el restaurante comprobó que esta salida se completó: "+effect+".\nNo se enviará nada a la impresora ni se modificará el pago. Si no puedes comprobarlo, cancela.")
            .setNegativeButton("Cancelar",null)
            .setPositiveButton("Sí, se completó",(dialog,which)->work(()->{
                usb.effects.confirmPhysical(owner,operation,effect);return "Resultado confirmado por el operador. No se repitió ningún envío.";
            })).show();
    }
    private void copy(String operation){
        if(busy)return;
        new android.app.AlertDialog.Builder(activity).setTitle("Imprimir copia")
            .setMessage("Se imprimirá una COPIA del ticket seleccionado. No se cobrará otra vez ni se abrirá la gaveta. Si el original quedó incompleto, retira ese papel antes de continuar.")
            .setNegativeButton("Cancelar",null).setPositiveButton("Imprimir copia",(dialog,which)->{
                final String id="copy-"+UUID.randomUUID();
                work(()->{usb.effects.copy(owner,operation,id);usb.sendPending(owner,id);return "Copia enviada. Comprueba el papel; no se modificó la venta.";});
            }).show();
    }
    private void draw(){
        root.removeAllViews();root.addView(label("EL CHINGADAZO · COBRO",24));
        root.addView(label("EN DESARROLLO · Integración de cobros",16));
        root.addView(button("Volver",back,!busy));
        TextView status=label(message,18);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);root.addView(status);
        root.addView(button("Conectar impresora",()->{try{usb.connect();message="Permiso solicitado si hacía falta. Después continúa los envíos pendientes.";}catch(IOException e){message=e.getMessage();}draw();},!busy));
        root.addView(button("Actualizar estado",this::load,!busy));
        ScrollView scroll=new ScrollView(activity);LinearLayout body=column();scroll.addView(body);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(pending!=null){
            body.addView(label((pending.confirmed?"PAGADA · finalizar":"COBRO POR CONFIRMAR")+" · "+NativeSales.money(pending.expected.total),22));
            body.addView(button("Recuperar el mismo cobro",()->work(()->complete(service.recover())),!busy));
        }else if(cart!=null&&cart.payment!=null){
            body.addView(label((cart.payment.confirmed?"MOSTRADOR PAGADO":"MOSTRADOR POR CONFIRMAR")+" · "+NativeSales.money(NativeSales.total(cart.lines)),22));
            body.addView(button("Recuperar el mismo cobro de mostrador",()->work(()->completeCounter(counter.recover(owner))),!busy));
        }else if(state!=null&&cart!=null){
            NativeTables.Account account=state.account(tableId);NativeTables.Table table=state.tables.get(tableId);
            boolean counterSale="counter".equals(tableId);long total=counterSale?NativeSales.total(cart.lines):account==null?0:account.total;
            if(counterSale?!cart.lines.isEmpty()&&cart.pending==null:account!=null&&account.status.equals("open")){
                body.addView(label((counterSale?"Mostrador":"Mesa "+table.number)+" · Total "+NativeSales.money(total),24));
                if(counterSale){for(NativeSales.Line line:cart.lines)body.addView(label(line.qty+" × "+line.name+" · "+NativeSales.money(line.total()),17));}
                else for(String item:account.items)body.addView(label(item,17));
                body.addView(label("Forma de pago",18));method=new Spinner(activity);
                method.setBackgroundColor(0xffeeeeee);method.setAdapter(new ArrayAdapter<String>(activity,android.R.layout.simple_spinner_dropdown_item,new String[]{"Efectivo","Tarjeta","Transferencia"}));body.addView(method);
                TextView caption=label("Efectivo recibido (L)",18);body.addView(caption);received=new EditText(activity);received.setId(View.generateViewId());caption.setLabelFor(received.getId());
                received.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);received.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(16)});received.setTextColor(0xffffffff);received.setTextSize(22);received.setText(BigDecimal.valueOf(total,2).toPlainString());body.addView(received);
                TextView change=label("Cambio: L. 0.00",20);body.addView(change);
                Runnable recalculate=()->{
                    boolean cash=method.getSelectedItem().equals("Efectivo");received.setEnabled(cash&&!busy);
                    if(!cash){change.setText("Sin cambio · no se abre gaveta");return;}
                    try{long amount=new BigDecimal(received.getText().toString().trim().replace(',','.')).movePointRight(2).longValueExact();
                        change.setText(amount<total?"Efectivo insuficiente":"Cambio: "+NativeSales.money(amount-total));}
                    catch(RuntimeException e){change.setText("Revisa el efectivo recibido");}
                };
                received.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){recalculate.run();}public void afterTextChanged(android.text.Editable e){}});
                method.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onItemSelected(AdapterView<?> p,View v,int i,long id){recalculate.run();}public void onNothingSelected(AdapterView<?> p){}});
                body.addView(button("Cobrar e imprimir",()->pay(true),!busy));body.addView(button("Cobrar sin imprimir",()->pay(false),!busy));
            }else body.addView(label(account==null?"No hay una cuenta abierta en esta mesa.":"Esta cuenta no admite otro cobro. Consulta su estado en Mesas.",18));
        }
        for(Map.Entry<String,Map<String,Integer>> operation:jobs.entrySet()){
            if(operation.getValue().isEmpty())continue;body.addView(label("Salida · "+operation.getKey(),16));boolean todo=false;
            for(Map.Entry<String,Integer> job:operation.getValue().entrySet()){
                int s=job.getValue();todo|=s==NativeEffects.PENDING;
                body.addView(label(job.getKey()+": "+(s==NativeEffects.PENDING?"pendiente":s==NativeEffects.UNKNOWN?"resultado desconocido; revisar físicamente":s==NativeEffects.VERIFIED?"comprobado por el operador":"transferido por USB"),16));
                if(s==NativeEffects.UNKNOWN)body.addView(button("Confirmar resultado físico: "+job.getKey(),()->confirmPhysical(operation.getKey(),job.getKey()),!busy));
            }
            boolean protectedOutput=(pending!=null&&pending.expected.operation.equals(operation.getKey()))||(cart!=null&&cart.payment!=null&&cart.payment.id.equals(operation.getKey()));
            body.addView(button("Continuar solo envíos no intentados",()->work(()->{usb.sendPending(owner,operation.getKey());return "Envíos procesados. Los resultados desconocidos no se repiten.";}),!busy&&todo&&!protectedOutput&&cart!=null));
            Integer client=operation.getValue().get("client");
            if(client!=null&&client!=NativeEffects.PENDING)body.addView(button("Imprimir copia",()->copy(operation.getKey()),!busy&&pending==null&&cart!=null&&cart.payment==null));
        }
    }
    private LinearLayout column(){LinearLayout v=new LinearLayout(activity);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private TextView label(String text,int size){TextView v=new TextView(activity);v.setText(text);v.setTextSize(size);v.setTextColor(0xffffce24);v.setPadding(dp(4),dp(4),dp(4),dp(4));return v;}
    private Button button(String text,Runnable action,boolean enabled){Button b=new Button(activity);b.setText(text);b.setAllCaps(false);b.setTextSize(18);b.setMinHeight(dp(56));b.setTextColor(0xff151515);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffffce24));b.setEnabled(enabled);b.setOnClickListener(v->action.run());return b;}
    private int dp(int n){return Math.round(n*activity.getResources().getDisplayMetrics().density);}
}
