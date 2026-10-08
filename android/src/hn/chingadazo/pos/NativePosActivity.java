package hn.chingadazo.pos;

/** Integrated build under development. Not a second application per capability. */
public final class NativePosActivity extends NativeAccessActivity {
    private NativeSalesView sales;
    private NativeTablesView tables;
    private NativeShiftsView shifts;
    private NativePaymentsView payments;
    @Override protected void verified(NativeAccess.Profile profile) {
        openSales(profile,"counter");
    }
    private void openSales(NativeAccess.Profile profile,String context){
        if(payments!=null){payments.stop();payments=null;}
        if(!profile.role.equals("admin") && !profile.role.equals("cashier"))return;
        if(sales!=null)sales.stop();
        if(tables!=null){tables.stop();tables=null;}
        if(shifts!=null){shifts.stop();shifts=null;}
        try{sales=new NativeSalesView(this,nativeAccess(),profile,()->{sales.stop();sales=null;showAccessAndLogout();},()->openTables(profile),()->openShifts(profile,context),context,next->openSales(profile,next),()->openPayment(profile,"counter"));}
        catch(java.io.IOException e){showAccessAndLogout();return;}
        setContentView(sales.root);sales.load();
    }
    private void openTables(NativeAccess.Profile profile){
        if(payments!=null){payments.stop();payments=null;}
        if(sales!=null){sales.stop();sales=null;}
        tables=new NativeTablesView(this,nativeAccess(),profile,()->verified(profile),context->openSales(profile,context),table->openPayment(profile,table));
        setContentView(tables.root);tables.load();
    }
    private void openShifts(NativeAccess.Profile profile,String context){
        if(sales!=null){sales.stop();sales=null;}
        if(tables!=null){tables.stop();tables=null;}
        shifts=new NativeShiftsView(this,nativeAccess(),profile,()->openSales(profile,context));setContentView(shifts.root);shifts.load();
    }
    private void openPayment(NativeAccess.Profile profile,String table){
        if(sales!=null){sales.stop();sales=null;}
        if(tables!=null){tables.stop();tables=null;}
        try{payments=new NativePaymentsView(this,nativeAccess(),profile,table,()->{if(table.equals("counter"))openSales(profile,"counter");else openTables(profile);});setContentView(payments.root);payments.load();}
        catch(java.io.IOException e){openSales(profile,"counter");}
    }
    @Override protected void onStop() { if(payments!=null)payments.stop();if(sales!=null)sales.stop();if(tables!=null)tables.stop();if(shifts!=null)shifts.stop();super.onStop(); }
}
