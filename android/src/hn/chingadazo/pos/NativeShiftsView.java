package hn.chingadazo.pos;
import android.app.Activity;
import android.widget.*;
import android.text.InputType;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.math.BigDecimal;

/** Explicit opening/closing only. Background recovery never opens or closes a shift. */
final class NativeShiftsView {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    final LinearLayout root;private final Activity activity;private final NativeAccess access;private final NativeAccess.Profile profile;private final Runnable back;
    private final NativeScreenState screen=new NativeScreenState();private final NativeShiftJournal journal;
    private NativeShifts.Shift current;private Map<String,Object> pending;private boolean busy,loaded;
    private java.util.List<NativeShifts.Shift> reconciliations=Collections.emptyList();
    private String message="Consultando turno…";
    NativeShiftsView(Activity activity,NativeAccess access,NativeAccess.Profile profile,Runnable back){
        this.activity=activity;this.access=access;this.profile=profile;this.back=back;
        journal=new NativeShiftJournal(new NativeDraftStore(activity.getApplicationContext(),"shifts"),new NativeShiftJournal.Gateway(){
            public Map<String,Object> read(String id)throws IOException{return access.shift(profile.id,id);}
            public Map<String,Object> send(Map<String,Object> c)throws IOException{return access.changeShift(profile.id,profile.name,c);}
        });
        root=column();root.setBackgroundColor(0xff12130f);root.setPadding(20,20,20,20);screen.start();
    }
    void stop(){screen.stop();root.removeAllViews();}
    void load(){work(false,null);}
    private void work(boolean mutate,Map<String,Object> c){
        long ticket=screen.begin();if(ticket<0)return;busy=true;loaded=false;message="Comprobando turno…";draw();
        IO.execute(()->{
            if(!screen.current(ticket))return;NativeShifts.Shift next=null;Map<String,Object> intent=null;String error=null;java.util.List<NativeShifts.Shift> unfinished=Collections.emptyList();
            try{if(mutate)journal.run(profile.id,c);intent=journal.pending(profile.id);Map<String,Object> all=access.shifts(profile.id);next=NativeShifts.current(all,profile.id,System.currentTimeMillis());unfinished=NativeShifts.reconciliations(all,profile.id);}
            catch(IOException e){error=e.getMessage();try{intent=journal.pending(profile.id);}catch(IOException ignored){error="No se pudo leer el intento protegido. No borres datos.";}}
            NativeShifts.Shift result=next;Map<String,Object> saved=intent;String failure=error;java.util.List<NativeShifts.Shift> unfinishedResult=unfinished;
            activity.runOnUiThread(()->{if(!screen.finish(ticket))return;busy=false;loaded=failure==null;current=result;pending=saved;
                reconciliations=unfinishedResult;message=failure==null?(mutate?"Operación de turno confirmada.":"Turnos consultados."):failure;draw();});
        });
    }
    private void draw(){
        root.removeAllViews();root.addView(label("EL CHINGADAZO · TURNO",24));root.addView(label(message,18));
        root.addView(button("Volver a caja",back,!busy));root.addView(button("Actualizar",this::load,!busy));
        if(pending!=null){root.addView(label("Hay una operación guardada por confirmar. No se sustituirá por otro turno.",18));root.addView(button("Recuperar operación pendiente",()->work(true,null),!busy));return;}
        if(!loaded)return;
        root.addView(label(current==null?"No hay turno propio abierto.":"Turno abierto · Fondo "+NativeSales.money(current.fund),22));
        root.addView(button(current==null?"Abrir turno":"Cerrar y arquear turno",()->edit(current),!busy));
        ScrollView scroll=new ScrollView(activity);LinearLayout list=column();scroll.addView(list);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        for(NativeShifts.Shift s:reconciliations)list.addView(button("Completar arqueo · "+s.openedAt+" · esperado "+NativeSales.money(s.expected),()->edit(s),!busy));
    }
    private void edit(NativeShifts.Shift shift){
        if(busy||!loaded||pending!=null)return;boolean opening=shift==null;String id=opening?"shift-"+UUID.randomUUID():shift.id;
        LinearLayout form=column();EditText amount=new EditText(activity);amount.setHint(opening?"Fondo inicial (L)":"Efectivo contado (L)");amount.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);form.addView(amount);
        EditText note=new EditText(activity);note.setHint("Nota de cierre (opcional)");if(!opening)form.addView(note);
        android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(activity).setTitle(opening?"Abrir mi turno":"Cerrar mi turno").setView(form).setNegativeButton("Cancelar",null).setPositiveButton("Confirmar",null).create();
        dialog.setOnShowListener(v->dialog.getButton(-1).setOnClickListener(w->{
            try{long cents=new BigDecimal(amount.getText().toString().trim().replace(',','.')).movePointRight(2).longValueExact();
                Map<String,Object> command=NativeShiftJournal.command(opening?"open":"close",id,cents,opening?"":note.getText().toString().trim());dialog.dismiss();work(true,command);
            }catch(IOException|ArithmeticException|NumberFormatException e){amount.setError("Introduce un importe válido con máximo dos decimales.");}
        }));dialog.show();
    }
    private LinearLayout column(){LinearLayout value=new LinearLayout(activity);value.setOrientation(LinearLayout.VERTICAL);return value;}
    private TextView label(String text,int size){TextView value=new TextView(activity);value.setText(text);value.setTextColor(0xffffce24);value.setTextSize(size);value.setPadding(8,12,8,12);return value;}
    private Button button(String text,Runnable action,boolean enabled){Button value=new Button(activity);value.setText(text);value.setEnabled(enabled);value.setOnClickListener(v->action.run());return value;}
}
