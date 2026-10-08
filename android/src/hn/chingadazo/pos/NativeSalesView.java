package hn.chingadazo.pos;

import android.app.Activity;
import android.view.View;
import android.widget.*;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/** Native cash composition. No payment/printing controls until their integration is verified. */
final class NativeSalesView {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static NativeDrafts.Store draftStore;
    private final NativeDrafts drafts;private final String context;private final ContextNavigation navigation;
    interface ContextNavigation {void open(String context);}
    final LinearLayout root;
    private final Activity activity;private final NativeAccess.Profile profile;private final Runnable logout,tables,shifts,payments;
    private final NativeAccess access;private final NativeConsumption consumption;
    private final NativeUsb usb;private String queuedKitchen;
    private final NativeScreenState screen=new NativeScreenState();
    private NativeCatalog catalog;private NativeDrafts.Draft draft;private NativeTables remote;
    private String category="",message="Cargando catálogo y cuenta…";
    private boolean busy=true; private TextView status;
    NativeSalesView(Activity activity,NativeAccess access,NativeAccess.Profile profile,Runnable logout,Runnable tables,Runnable shifts,String context,ContextNavigation navigation,Runnable payments) throws IOException {
        this.activity=activity;this.access=access;this.profile=profile;this.logout=logout;this.tables=tables;
        this.context=context;this.navigation=navigation;this.shifts=shifts;
        this.payments=payments;
        usb=NativeUsb.get(activity);
        if(draftStore==null)draftStore=new NativeDraftStore(activity.getApplicationContext());
        drafts=new NativeDrafts(new NativeDraftContexts(draftStore,context));
        consumption=new NativeConsumption(drafts,new NativeConsumption.Gateway(){
            public Map<String,Object> read()throws IOException{return access.dining(profile.id);}
            public void validate(Map<String,Object> command)throws IOException{NativeHttp.validateConsumption(command);}
            public Map<String,Object> send(Map<String,Object> command)throws IOException{return access.consume(profile.id,command);}
        },context,new NativeConsumption.Accepted(){
            public void validate(NativeDrafts.Draft batch)throws IOException{NativePaidEffects.kitchen(batch);}
            public void enqueue(String owner,NativeDrafts.Draft batch)throws IOException{
                if(batch.pending.kitchen){usb.effects.enqueue(owner,batch.pending.operation,NativePaidEffects.kitchen(batch));queuedKitchen=batch.pending.operation;}
            }
        });
        root=column();root.setBackgroundColor(0xff12130f);root.setPadding(dp(12),dp(8),dp(12),dp(8));
        screen.start();draw();
    }
    void stop() { screen.stop();root.removeAllViews(); }
    void load() {
        long ticket=screen.begin();if(ticket<0)return;
        busy=true;draw();IO.execute(()->{
            if(!screen.current(ticket))return;
            NativeCatalog next=null;NativeDrafts.Draft saved=null;NativeTables tablesState=null;String error=null;
            try { saved=drafts.load(profile.id); }
            catch(IOException e){error="No se pudo recuperar la cuenta protegida. No borres datos.";}
            if(error==null)try{next=NativeCatalog.fetch(new NativeHttp());}catch(IOException e){error="No se pudo actualizar el catálogo. La cuenta guardada se conserva.";}
            if(!context.equals("counter"))try{tablesState=NativeTables.parse(access.dining(profile.id));}catch(IOException e){error="No se pudo consultar el saldo de la mesa. Los productos locales se conservan.";}
            NativeCatalog result=next;NativeDrafts.Draft recovered=saved;String failure=error;
            NativeTables confirmed=tablesState;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;catalog=result;draft=recovered;remote=confirmed;busy=false;
                message=failure==null?"Cuenta local recuperada. Todavía no enviada ni cobrada.":failure;draw();});
        });
    }
    private void save(int index,NativeSales.Line line) {
        if(busy||draft==null||draft.pending!=null||draft.payment!=null)return;
        final List<NativeSales.Line> next;
        try{next=NativeSales.replace(draft.lines,index,line);}catch(IOException e){message=e.getMessage();draw();return;}
        long revision=draft.revision,ticket=screen.begin();if(ticket<0)return;
        busy=true;message="Guardando cuenta…";draw();
        IO.execute(()->{
            // An edit already accepted remains tied to its original operator even on backgrounding.
            NativeDrafts.Draft saved=null;String failure=null;
            try{saved=drafts.save(profile.id,revision,next);}catch(IOException e){failure="No se guardó el cambio. Conservamos la cuenta anterior; vuelve a cargarla.";}
            NativeDrafts.Draft result=saved;String error=failure;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;busy=false;if(result!=null)draft=result;
                message=error==null?"Cuenta guardada en este equipo. Sin enviar ni cobrar.":error;draw();});
        });
    }
    private void draw() {
        root.removeAllViews();LinearLayout header=new LinearLayout(activity);
        TextView brand=label("EL CHINGADAZO · CAJA",22,0xffffce24);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        header.addView(button("Mesas",tables,!busy));header.addView(button("Turno",shifts,!busy));header.addView(button("Cambiar usuario",logout,!busy));root.addView(header);
        LinearLayout contexts=new LinearLayout(activity);contexts.addView(button("Mostrador",()->navigation.open("counter"),!busy&&!context.equals("counter")));
        contexts.addView(button("Recuperar cuentas locales",this::chooseDraft,!busy));root.addView(contexts);
        contexts.addView(button("Impresora / tickets",payments,!busy));
        root.addView(label(profile.name,16,0xffeeeeee));
        root.addView(label("EN DESARROLLO — Integración de caja, cobros e impresión.",16,0xffffce24));
        status=label(message,16,0xffeeeeee);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);root.addView(status);
        LinearLayout body=new LinearLayout(activity);
        boolean wide=activity.getResources().getConfiguration().screenWidthDp>=700;
        body.setOrientation(wide?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);
        root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout menu=column(),account=column();
        body.addView(scroll(menu),new LinearLayout.LayoutParams(wide?0:-1,wide?-1:0,wide?2:1));
        body.addView(scroll(account),new LinearLayout.LayoutParams(wide?0:-1,wide?-1:0,1));
        menu.addView(button("Actualizar catálogo / recuperar cuenta",this::load,!busy));
        if(catalog!=null) {
            LinearLayout catalogBody=new LinearLayout(activity);catalogBody.setOrientation(wide?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);menu.addView(catalogBody);
            LinearLayout tabs=new LinearLayout(activity);tabs.setOrientation(wide?LinearLayout.VERTICAL:LinearLayout.HORIZONTAL);
            if(wide)catalogBody.addView(tabs,new LinearLayout.LayoutParams(dp(140),-2));
            else {HorizontalScrollView bar=new HorizontalScrollView(activity);bar.addView(tabs);catalogBody.addView(bar);}
            tabs.addView(button("Todo",()->{category="";draw();},!busy));
            for(Map.Entry<String,String> entry:catalog.categories.entrySet())tabs.addView(button(entry.getValue(),()->{category=entry.getKey();draw();},!busy));
            GridLayout grid=new GridLayout(activity);
            int available=activity.getResources().getConfiguration().screenWidthDp;
            int columns=wide?Math.max(1,((available-24)*2/3-140)/188):1;
            grid.setColumnCount(columns);catalogBody.addView(grid,new LinearLayout.LayoutParams(wide?0:-1,-2,wide?1:0));
            for(NativeSales.Product p:catalog.products) {
                if(!p.available||(!category.isEmpty()&&!p.category.equals(category)))continue;
                Button tile=button(p.name+"\n"+NativeSales.money(p.price),()->edit(p,-1,null),!busy&&draft!=null&&draft.pending==null&&draft.payment==null);
                LinearLayout card=column();ImageView photo=new ImageView(activity);photo.setScaleType(ImageView.ScaleType.CENTER_CROP);card.addView(photo,new LinearLayout.LayoutParams(-1,dp(86)));NativePictures.bind(photo,p.image);card.addView(tile,new LinearLayout.LayoutParams(-1,dp(104)));
                GridLayout.LayoutParams layout=new GridLayout.LayoutParams();layout.width=dp(wide?180:260);layout.height=-2;layout.setMargins(dp(4),dp(4),dp(4),dp(4));grid.addView(card,layout);
            }
            if(catalog.products.isEmpty())menu.addView(label("No hay productos en el catálogo.",18,0xffffffff));
        }
        account.setPadding(dp(12),0,0,0);account.addView(label(context.equals("counter")?"Mostrador · productos nuevos":"Cuenta de mesa · productos nuevos",22,0xffffce24));
        if(!context.equals("counter")){
            NativeTables.Account stored=remote!=null&&context.startsWith("account-")?remote.accounts.get(context.substring(8)):null;
            NativeTables.Table selected=remote==null?null:remote.tables.get(stored!=null?stored.tableId:context.startsWith("table-")?context.substring(6):"");
            account.addView(label(selected==null?"Cuenta: "+context:"Mesa "+selected.number,20,0xffffce24));
            account.addView(label(stored!=null?"Saldo guardado: "+NativeSales.money(remote.pending(stored.tableId)):selected!=null&&selected.accountId.isEmpty()?"Mesa libre · sin cuenta guardada":"Saldo no disponible para esta cuenta. No equivale a cero.",18,0xffffffff));
            if(stored!=null)for(String item:stored.items)account.addView(label(item,16,0xffdddddd));
            account.addView(label("Productos NUEVOS sin enviar:",18,0xffffce24));
        }
        if(draft==null){account.addView(label("Cuenta no disponible. No agregues productos hasta recuperarla.",18,0xffffffff));return;}
        if(context.equals("counter"))account.addView(button(draft.payment!=null?"Recuperar cobro de mostrador":"Cobrar cuenta de mostrador",payments,!busy&&draft.pending==null&&!draft.lines.isEmpty()));
        if(draft.payment!=null)account.addView(label("Cobro guardado: "+draft.payment.id+". No modifiques ni vuelvas a crear esta cuenta.",18,0xffffce24));
        if(draft.pending!=null){
            account.addView(label("Envío pendiente de confirmar · mesa "+draft.pending.table+". No vuelvas a crear este pedido.",18,0xffffce24));
            account.addView(button("Recuperar el mismo envío",()->submit(null),!busy));
        }
        for(int index=0;index<draft.lines.size();index++) {
            final int position=index;NativeSales.Line line=draft.lines.get(index);
            account.addView(label(line.qty+" × "+line.name+"\n"+line.modsText+"\n"+line.note+"\n"+NativeSales.money(line.total()),18,0xffffffff));
            LinearLayout actions=new LinearLayout(activity);
            NativeSales.Product product=find(line.productId);
            actions.addView(button("Editar",()->edit(product,position,line),!busy&&draft.pending==null&&draft.payment==null&&product!=null&&product.available));
            actions.addView(button("Quitar",()->save(position,null),!busy&&draft.pending==null&&draft.payment==null));account.addView(actions);
        }
        if(draft.lines.isEmpty())account.addView(label("Selecciona productos del menú.",18,0xffeeeeee));
        account.addView(label("Total estimado: "+NativeSales.money(NativeSales.total(draft.lines)),22,0xffffce24));
        account.addView(label("No es una factura ni un pago registrado.",16,0xffeeeeee));
        android.content.SharedPreferences preferences=activity.getSharedPreferences("native-print",0);
        CheckBox kitchen=new CheckBox(activity);kitchen.setText("Imprimir comanda de cocina");kitchen.setTextColor(0xffffffff);kitchen.setChecked(preferences.getBoolean("kitchen",false));kitchen.setEnabled(!busy&&draft.pending==null);
        kitchen.setOnCheckedChangeListener((view,checked)->{if(!preferences.edit().putBoolean("kitchen",checked).commit()){message="No se guardó la configuración de cocina.";draw();}});account.addView(kitchen);
        account.addView(button("Enviar productos nuevos a mesa",this::chooseTable,!busy&&draft.pending==null&&draft.payment==null&&!draft.lines.isEmpty()));
    }
    private void chooseTable(){
        if(busy||draft==null||draft.pending!=null||draft.payment!=null||draft.lines.isEmpty())return;
        long ticket=screen.begin();if(ticket<0)return;busy=true;message="Consultando mesas disponibles…";draw();
        IO.execute(()->{
            List<NativeTables.Table> choices=new ArrayList<>();List<String> labels=new ArrayList<>();String failure=null;
            try{Map<String,Object> raw=access.dining(profile.id);NativeTables state=NativeTables.parse(raw);
                if(!state.initialized||!Boolean.TRUE.equals(raw.get("consumptionsEnabled")))throw new IOException("El servidor no tiene habilitado el envío a mesas.");
                for(NativeTables.Table t:state.tables.values()){NativeTables.Account a=state.account(t.id);
                    if(t.active&&(a==null||a.status.equals("open"))&&NativeDraftContexts.destination(context,t.id,t.accountId))choices.add(t);}
                Collections.sort(choices,(a,b)->Integer.compare(a.number,b.number));
                for(NativeTables.Table t:choices)labels.add("Mesa "+t.number+" · "+(t.accountId.isEmpty()?"Libre":"Saldo "+NativeSales.money(state.pending(t.id))));
            }catch(IOException e){failure=e.getMessage();}
            String error=failure;activity.runOnUiThread(()->{if(!screen.finish(ticket))return;busy=false;
                message=error!=null?error:choices.isEmpty()?"No hay mesas disponibles. La cuenta se conserva.":"Elige la mesa que recibirá estos productos nuevos.";draw();
                if(error==null&&!choices.isEmpty())new android.app.AlertDialog.Builder(activity).setTitle("Enviar pedido a mesa")
                    .setItems(labels.toArray(new String[0]),(dialog,index)->submit(choices.get(index))).setNegativeButton("Cancelar",null).show();
            });
        });
    }
    private void submit(NativeTables.Table target){
        if(busy||draft==null)return;long ticket=screen.begin();if(ticket<0)return;
        long revision=draft.revision;final boolean printKitchen=activity.getSharedPreferences("native-print",0).getBoolean("kitchen",false);busy=true;message="Confirmando envío de productos…";draw();
        IO.execute(()->{
            String failure=null;NativeDrafts.Draft saved=null;NativeTables confirmed=null;
            queuedKitchen=null;
            try{confirmed=consumption.run(profile.id,target==null?null:target.id,revision,target==null?null:target.accountId,printKitchen);
                if(queuedKitchen!=null)try{usb.sendPending(profile.id,queuedKitchen);}catch(IOException physical){failure="Pedido GUARDADO en mesa. Comanda pendiente de revisar en Impresora / tickets: "+physical.getMessage();}
            }
            catch(IOException e){failure=e.getMessage();}
            try{saved=drafts.load(profile.id);}catch(IOException e){failure="No se pudo recuperar la cuenta protegida. No borres datos ni repitas el pedido.";}
            NativeDrafts.Draft recovered=saved;String error=failure;NativeTables result=confirmed;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;draft=recovered;remote=result;busy=false;
                message=error==null?"Pedido confirmado en la mesa. No se ha cobrado. Si activaste cocina, comprueba la comanda.":error;draw();
                if(error==null&&result!=null&&context.startsWith("table-")){
                    NativeTables.Account created=result.account(context.substring(6));
                    if(created!=null&&created.status.equals("open"))navigation.open("account-"+created.id);
                }
            });
        });
    }
    private void chooseDraft(){
        if(busy)return;long ticket=screen.begin();if(ticket<0)return;busy=true;draw();
        IO.execute(()->{
            List<String> choices=new ArrayList<>();String failure=null;
            try{choices=NativeDraftContexts.list(draftStore,profile.id);}catch(IOException e){failure="No se pudieron leer las cuentas. No borres datos.";}
            List<String> saved=choices;String error=failure;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;busy=false;message=error!=null?error:saved.isEmpty()?"No hay productos locales pendientes.":"Selecciona la cuenta que deseas recuperar.";draw();
                if(error==null&&!saved.isEmpty())new android.app.AlertDialog.Builder(activity).setTitle("Cuentas locales sin enviar")
                    .setItems(saved.toArray(new String[0]),(dialog,index)->{long active=screen.begin();if(active>=0)navigation.open(saved.get(index));}).setNegativeButton("Cancelar",null).show();
            });
        });
    }
    private NativeSales.Product find(String id){if(catalog!=null)for(NativeSales.Product p:catalog.products)if(p.id.equals(id))return p;return null;}
    private void edit(NativeSales.Product product,int position,NativeSales.Line line) {
        if(busy||product==null||draft==null||draft.pending!=null||draft.payment!=null)return;
        NativeLineEditor.show(activity,product,line,result->save(position,result));
    }
    private LinearLayout column(){LinearLayout view=new LinearLayout(activity);view.setOrientation(LinearLayout.VERTICAL);return view;}
    private ScrollView scroll(View child){ScrollView view=new ScrollView(activity);view.setFillViewport(true);view.addView(child);return view;}
    private TextView label(String text,int size,int color){TextView view=new TextView(activity);view.setText(text);view.setTextSize(size);view.setTextColor(color);view.setPadding(dp(4),dp(4),dp(4),dp(4));return view;}
    private Button button(String text,Runnable action,boolean enabled){Button view=new Button(activity);view.setText(text);view.setAllCaps(false);view.setTextSize(17);view.setMinHeight(dp(56));view.setTextColor(0xff151515);view.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffffce24));view.setEnabled(enabled);view.setOnClickListener(v->action.run());return view;}
    private int dp(int value){return Math.round(value*activity.getResources().getDisplayMetrics().density);}
}
