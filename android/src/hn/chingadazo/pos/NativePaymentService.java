package hn.chingadazo.pos;
import java.io.IOException;
import java.util.Map;

/** Authenticated table-payment path; downstream effects retain their independent journals. */
final class NativePaymentService {
    interface Clock {long now()throws IOException;}
    private final NativeAccess access;private final String owner;private final NativeCheckout checkout;private final NativeRelease release;private final Clock clock;
    NativePaymentService(NativeAccess access,String owner,NativeDrafts.Store payments,NativeDrafts.Store releases,Clock clock){
        this.access=access;this.owner=owner;this.clock=clock;
        checkout=new NativeCheckout(payments,new NativeCheckout.Gateway(){
            public Map<String,Object> order(String id)throws IOException{return access.order(owner,id);}
            public void send(Map<String,Object> command)throws IOException{access.checkout(owner,command);}
        });
        release=new NativeRelease(releases,new NativeRelease.Gateway(){
            public Map<String,Object> read()throws IOException{return access.dining(owner);}
            public Map<String,Object> send(Map<String,Object> command)throws IOException{return access.release(owner,command);}
        });
    }
    synchronized NativeCheckout.Intent table(String table,String account,long revision,long total,String payment,long received,boolean print)throws IOException{
        if(checkout.pending(owner)!=null)throw new IOException("Recupera primero el cobro anterior. No se inició otro cobro.");
        Map<String,Object> dining=access.dining(owner),shifts=access.shifts(owner);
        return checkout.run(owner,NativePaymentPreparation.table(dining,shifts,owner,table,account,revision,total,payment,received,print,clock.now()));
    }
    synchronized NativeCheckout.Intent pending()throws IOException{return checkout.pending(owner);}
    synchronized void retireTransferred(NativeEffects effects)throws IOException{
        NativeCheckout.Intent current=checkout.pending(owner);
        effects.retireTransferred(owner,current==null?"":current.expected.operation);
    }
    synchronized NativeCheckout.Intent recover()throws IOException{return checkout.run(owner,null);}
    synchronized void finish(NativeEffects effects)throws IOException{
        releaseConfirmed();checkout.finish(owner,effects);
    }
    synchronized NativeTables releaseConfirmed()throws IOException{
        NativeCheckout.Intent intent=checkout.pending(owner);
        if(intent==null||!intent.confirmed)throw new IOException("El pago no está confirmado. No se liberó ninguna mesa.");
        if(release.pending(owner)==null){
            NativeTables current=NativeTables.parse(access.dining(owner));
            // The old occupation may already be released and the table reused.
            // Complete only its receipt handoff; never release the new account.
            if(current.initialized&&current.tables.containsKey(intent.expected.table)&&!current.accounts.containsKey(intent.expected.account))return current;
        }
        return release.run(owner,intent.expected.table,intent.expected.account);
    }
}
