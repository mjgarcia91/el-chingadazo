package hn.chingadazo.pos;
import android.app.Activity;
import android.view.View;
import android.widget.*;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/** Native salon, account navigation, durable layout/transfer and paid-only release. */
final class NativeTablesView {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    final LinearLayout root;private final Activity activity;private final String owner;private final Runnable back;
    private final NativeRelease release;private final NativeRelease.Gateway gateway;private final NativeSalesView.ContextNavigation openAccount;
    private final NativeTableChanges changes;private final boolean admin;private Map<String,Object> pendingChange;
    private final NativeSalesView.ContextNavigation payment;
    private final NativeScreenState screen=new NativeScreenState();
    private NativeTables state;private NativeRelease.Intent pending;private boolean busy;private String selected="",message="Cargando mesas…";
    NativeTablesView(Activity activity,NativeAccess access,NativeAccess.Profile profile,Runnable back,NativeSalesView.ContextNavigation openAccount,NativeSalesView.ContextNavigation payment){
        this.activity=activity;owner=profile.id;this.back=back;
        this.openAccount=openAccount;
        this.payment=payment;
        admin=profile.role.equals("admin");
        gateway=new NativeRelease.Gateway(){
            public Map<String,Object> read()throws IOException{return access.dining(owner);}
            public Map<String,Object> send(Map<String,Object> command)throws IOException{return access.release(owner,command);}
        };
        release=new NativeRelease(new NativeDraftStore(activity.getApplicationContext(),true),gateway);
        changes=new NativeTableChanges(new NativeDraftStore(activity.getApplicationContext(),"table-changes"),command->access.tableChange(owner,command));
        root=column();root.setBackgroundColor(0xff12130f);root.setPadding(dp(16),dp(8),dp(16),dp(8));screen.start();
    }
    void stop(){screen.stop();root.removeAllViews();}
    void load(){work(false,null);}
    private void work(boolean send,String table){
        work(send,table,false,null);
    }
    private void change(Map<String,Object> command){work(false,null,true,command);}
    private void work(boolean send,String table,boolean changing,Map<String,Object> command){
        long ticket=screen.begin();if(ticket<0)return;busy=true;message=changing?"Confirmando cambio del salón…":send?"Comprobando liberación…":"Actualizando mesas…";draw();
        IO.execute(()->{
            if(!screen.current(ticket))return;
            NativeTables next=null;NativeRelease.Intent saved=null;Map<String,Object> changeSaved=null;String error=null;
            try{next=changing?changes.run(owner,command):send?release.run(owner,table):NativeTables.parse(gateway.read());saved=release.pending(owner);changeSaved=changes.pending(owner);}
            catch(IOException e){next=null;error=e.getMessage();try{saved=release.pending(owner);changeSaved=changes.pending(owner);}catch(IOException ignored){error="No se pudieron leer los cambios pendientes. No borres datos.";}}
            NativeTables result=next;NativeRelease.Intent intent=saved;Map<String,Object> mutation=changeSaved;String failure=error;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;busy=false;state=result;pending=intent;pendingChange=mutation;
                message=failure!=null?failure:changing?"Cambio confirmado. Las cuentas y consumos se conservaron.":send?"Liberación confirmada. El historial y el pago se conservaron.":"Mesas actualizadas. Los saldos corresponden al servidor.";draw();});
        });
    }
    private void draw(){
        root.removeAllViews();root.addView(label("EL CHINGADAZO · MESAS",24,0xffffce24));
        root.addView(label("EN DESARROLLO · Mesas, cobro y liberación de cuentas pagadas.",16,0xffffffff));
        root.addView(button("Recuperar cobro / impresión pendiente",()->payment.open(""),!busy));
        LinearLayout nav=new LinearLayout(activity);nav.addView(button("Volver a caja",back,!busy));nav.addView(button("Actualizar mesas",this::load,!busy));root.addView(nav);
        TextView status=label(message,17,0xffffffff);status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);root.addView(status);
        if(pending!=null)root.addView(button("Consultar liberación pendiente",()->work(true,null),!busy));
        if(pendingChange!=null)root.addView(button("Recuperar cambio de mesa pendiente",()->change(null),!busy));
        if(state==null)return;
        if(!state.initialized){root.addView(label("El salón no está configurado. No se modificó ninguna mesa.",18,0xffffffff));return;}
        if(admin)root.addView(button("Agregar mesa",()->editTable(null),canChange()));
        boolean wide=activity.getResources().getConfiguration().screenWidthDp>=700;
        LinearLayout body=new LinearLayout(activity);body.setOrientation(wide?LinearLayout.HORIZONTAL:LinearLayout.VERTICAL);root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout list=column(),detail=column();body.addView(scroll(list),new LinearLayout.LayoutParams(wide?0:-1,wide?-1:0,1));body.addView(scroll(detail),new LinearLayout.LayoutParams(wide?0:-1,wide?-1:0,1));
        List<NativeTables.Table> ordered=new ArrayList<>(state.tables.values());Collections.sort(ordered,(a,b)->a.row==b.row?Integer.compare(a.column,b.column):Integer.compare(a.row,b.row));
        GridLayout grid=new GridLayout(activity);grid.setColumnCount(2);list.addView(grid);int cell=0;
        for(NativeTables.Table t:ordered){if(!t.active)continue;NativeTables.Account a=state.account(t.id);String caption=a==null?"Libre":a.status.equals("paid")?"Pagada":a.status.equals("checkout")?"Pago por confirmar":"Pendiente "+NativeSales.money(a.total);
            Button tile=button("Mesa "+t.number+"\n"+caption,()->{selected=t.id;draw();},!busy);
            GridLayout.LayoutParams layout=new GridLayout.LayoutParams(GridLayout.spec(cell/2),GridLayout.spec(cell%2,1f));layout.width=0;layout.height=dp(96);layout.setMargins(dp(4),dp(4),dp(4),dp(4));grid.addView(tile,layout);cell++;}
        NativeTables.Table table=state.tables.get(selected);
        if(table==null){detail.addView(label("Selecciona una mesa para consultar su cuenta.",20,0xffffffff));return;}
        detail.addView(label("Mesa "+table.number,24,0xffffce24));NativeTables.Account a=state.account(selected);
        if(admin)detail.addView(button("Editar número / posición",()->editTable(table),canChange()));
        if(a==null){detail.addView(label("Libre",20,0xffffffff));detail.addView(button("Agregar productos",()->openAccount.open("table-"+table.id),!busy));return;}
        detail.addView(label("Saldo pendiente: "+NativeSales.money(state.pending(selected)),22,0xffffce24));
        detail.addView(label("Total registrado: "+NativeSales.money(a.total),18,0xffffffff));
        for(String item:a.items)detail.addView(label(item,18,0xffffffff));
        detail.addView(button("Agregar productos a esta cuenta",()->openAccount.open("account-"+a.id),!busy&&a.status.equals("open")));
        detail.addView(button("Cobrar cuenta de mesa",()->payment.open(table.id),canChange()&&a.status.equals("open")));
        detail.addView(button("Trasladar cuenta a otra mesa",()->transfer(a),canChange()&&a.status.equals("open")));
        boolean ready=state.releasable(selected);
        detail.addView(button("Liberar mesa",()->work(true,table.id),!busy&&pending==null&&pendingChange==null&&ready));
        detail.addView(label(ready?"El pago está confirmado. Liberar conserva el comprobante.":"Solo se libera una mesa con pago confirmado. No se borrarán consumos.",17,0xffffffff));
    }
    private boolean canChange(){return !busy&&state!=null&&pending==null&&pendingChange==null;}
    private void editTable(NativeTables.Table table){
        if(!admin||!canChange())return;final long revision=state.revision;
        LinearLayout form=column();EditText number=numeric(form,"Número (1–999)",table==null?"":String.valueOf(table.number));
        EditText row=numeric(form,"Fila (1–50)",table==null?"":String.valueOf(table.row));
        EditText column=numeric(form,"Columna (1–4)",table==null?"":String.valueOf(table.column));
        new android.app.AlertDialog.Builder(activity).setTitle(table==null?"Agregar mesa":"Editar mesa").setView(form).setNegativeButton("Cancelar",null)
            .setPositiveButton("Guardar",(dialog,which)->{
                if(!canChange())return;
                try{Map<String,Object> command=NativeAccess.map("action","saveTable","operationId",UUID.randomUUID().toString(),"expectedRevision",revision,
                    "tableId",table==null?"table-"+UUID.randomUUID().toString():table.id,"table",NativeAccess.map("zoneId","salon","kind","table","active",true,"temporary",false,
                    "number",Integer.parseInt(number.getText().toString().trim()),"row",Integer.parseInt(row.getText().toString().trim()),"column",Integer.parseInt(column.getText().toString().trim())));
                    change(NativeRoutes.tableChange(command));
                }catch(IOException|NumberFormatException e){message="Revisa número, fila y columna. No se guardó ningún cambio.";draw();}
            }).show();
    }
    private EditText numeric(LinearLayout parent,String caption,String value){parent.addView(label(caption,18,0xff222222));EditText input=new EditText(activity);input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);input.setText(value);parent.addView(input);return input;}
    private void transfer(NativeTables.Account account){
        if(!canChange()||!account.status.equals("open"))return;final long revision=state.revision;
        List<NativeTables.Table> choices=new ArrayList<>();for(NativeTables.Table t:state.tables.values())if(t.active&&t.accountId.isEmpty())choices.add(t);
        Collections.sort(choices,(a,b)->Integer.compare(a.number,b.number));String[] labels=new String[choices.size()];for(int i=0;i<labels.length;i++)labels[i]="Mesa "+choices.get(i).number;
        if(choices.isEmpty()){message="No hay mesas libres para trasladar esta cuenta.";draw();return;}
        new android.app.AlertDialog.Builder(activity).setTitle("Trasladar cuenta · "+NativeSales.money(account.total)).setItems(labels,(dialog,index)->{
            if(canChange())change(NativeAccess.map("action","transfer","operationId",UUID.randomUUID().toString(),"expectedRevision",revision,"accountId",account.id,"destinationTableId",choices.get(index).id));
        }).setNegativeButton("Cancelar",null).show();
    }
    private LinearLayout column(){LinearLayout v=new LinearLayout(activity);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private ScrollView scroll(View child){ScrollView v=new ScrollView(activity);v.addView(child);return v;}
    private TextView label(String s,int size,int color){TextView v=new TextView(activity);v.setText(s);v.setTextSize(size);v.setTextColor(color);v.setPadding(dp(8),dp(8),dp(8),dp(8));return v;}
    private Button button(String s,Runnable action,boolean enabled){Button b=new Button(activity);b.setText(s);b.setAllCaps(false);b.setTextSize(18);b.setMinHeight(dp(56));b.setTextColor(0xff151515);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffffce24));b.setEnabled(enabled);b.setOnClickListener(v->action.run());return b;}
    private int dp(int n){return Math.round(n*activity.getResources().getDisplayMetrics().density);}
}
