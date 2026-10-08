package hn.chingadazo.pos;
import android.hardware.usb.*;
import java.io.IOException;

/** USB host APIs: https://developer.android.com/develop/connectivity/usb/host */
final class UsbPrinter {
 private final UsbManager manager;
 UsbPrinter(UsbManager manager){this.manager=manager;}
 UsbDevice device() throws IOException {
  UsbDevice found=null;
  for(UsbDevice d:manager.getDeviceList().values())if(PrinterCore.printer(d.getVendorId(),d.getProductId())){
   if(found!=null)throw new IOException("Hay dos impresoras iguales. Conecta solo la de caja.");found=d;
  }
  return found;
 }
 void send(byte[] bytes) throws IOException {
  UsbDevice d=device();
  if(d==null)throw new IOException("Impresora USB desconectada. Revisa el cable y la alimentación.");
  if(!manager.hasPermission(d))throw new IOException("Pulsa Conectar impresora para autorizar el acceso USB.");
  UsbInterface selected=null;UsbEndpoint endpoint=null;
  for(int i=0;i<d.getInterfaceCount()&&endpoint==null;i++){
   UsbInterface iface=d.getInterface(i);
   if(iface.getInterfaceClass()==UsbConstants.USB_CLASS_HID)continue;
   for(int j=0;j<iface.getEndpointCount();j++){
    UsbEndpoint e=iface.getEndpoint(j);
    if(e.getDirection()==UsbConstants.USB_DIR_OUT&&e.getType()==UsbConstants.USB_ENDPOINT_XFER_BULK){selected=iface;endpoint=e;break;}
   }
  }
  if(endpoint==null)throw new IOException("Esta impresora no ofrece salida USB bulk compatible.");
  UsbDeviceConnection connection=manager.openDevice(d);
  if(connection==null)throw new IOException("No se pudo abrir USB. Cierra HIOPOS/RawBT y comprueba el permiso.");
  boolean claimed=false;
  try{
   claimed=connection.claimInterface(selected,true);
   if(!claimed)throw new IOException("Impresora ocupada. Cierra HIOPOS/RawBT antes de volver a probar.");
   if(selected.getAlternateSetting()!=0&&!connection.setInterface(selected))throw new IOException("No se pudo seleccionar la interfaz USB.");
   final UsbEndpoint output=endpoint;
   PrinterCore.write(bytes,(b,o,n)->connection.bulkTransfer(output,b,o,n,2000));
  }finally{if(claimed)connection.releaseInterface(selected);connection.close();}
 }
}
