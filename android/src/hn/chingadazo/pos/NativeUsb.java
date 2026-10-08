package hn.chingadazo.pos;
import android.app.PendingIntent;
import android.content.*;
import android.hardware.usb.*;
import java.io.IOException;
import java.util.*;

/** Application-scoped journal and serialized printer. Permission never sends a command. */
final class NativeUsb {
    private static NativeUsb instance;
    final NativeEffects effects;
    private final Context context;private final UsbManager manager;private final UsbPrinter printer;
    static synchronized NativeUsb get(Context context){if(instance==null)instance=new NativeUsb(context.getApplicationContext());return instance;}
    private NativeUsb(Context context){this.context=context;manager=(UsbManager)context.getSystemService(Context.USB_SERVICE);printer=new UsbPrinter(manager);effects=new NativeEffects(new NativeDraftStore(context,"effects"));}
    synchronized void connect()throws IOException{
        UsbDevice device=printer.device();if(device==null)throw new IOException("Impresora desconectada o apagada.");
        if(!manager.hasPermission(device))manager.requestPermission(device,PendingIntent.getBroadcast(context,0,
            new Intent(context.getPackageName()+".USB_PERMISSION").setPackage(context.getPackageName()),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
    }
    synchronized void sendPending(String owner,String operation)throws IOException{
        Map<String,Integer> jobs=effects.list(owner).get(operation);if(jobs==null)throw NativeAccess.malformed();
        boolean pending=false;for(int state:jobs.values())if(state==NativeEffects.PENDING)pending=true;if(!pending)return;
        // Check permission/device before marking any physical job as attempted.
        UsbDevice device=printer.device();if(device==null)throw new IOException("Pago conservado. Envío pendiente: impresora apagada o desconectada.");
        if(!manager.hasPermission(device))throw new IOException("Pago conservado. Pulsa Conectar impresora y acepta el permiso USB.");
        String error=null;
        for(String kind:jobs.keySet())if(jobs.get(kind)==NativeEffects.PENDING){
            try{effects.send(owner,operation,kind,printer::send);}catch(IOException e){error=e.getMessage();}
        }
        if(error!=null)throw new IOException(error);
    }
}
