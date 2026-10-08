package hn.chingadazo.pos;
import java.nio.charset.StandardCharsets;
/** Fixed diagnostic commands only. No sales, arbitrary bytes or automatic retries. */
public final class UsbTestCommands {
 private UsbTestCommands(){}
 public static byte[] bytes(String action){
  if("print".equals(action))return ("\u001b@\u001ba\u0000EL CHINGADAZO\nPRUEBA USB - NO ES UNA VENTA\nTexto nativo sin WebView ni RawBT.\n\n\n\n").getBytes(StandardCharsets.US_ASCII);
  if("cut".equals(action))return new byte[]{10,10,10,29,86,0};
  if("drawer".equals(action))return PrinterCore.drawer();
  throw new IllegalArgumentException("Accion de prueba desconocida");
 }
}
