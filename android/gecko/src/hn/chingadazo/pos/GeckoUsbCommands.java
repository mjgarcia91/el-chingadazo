package hn.chingadazo.pos;
import java.nio.charset.StandardCharsets;
/** Hardware commands for the Gecko evaluation; old APK encodings stay unchanged. */
public final class GeckoUsbCommands {
 public static void requireTestTicket(String text){
  PrinterCore.ticket(text);
  // Evaluation-only accidental live-order guard, not an authorization mechanism.
  for(String line:text.split("\n"))if("PRUEBA-IMPRESORA".equals(line.trim()))return;
  throw new IllegalArgumentException("Versión USB de prueba: usa únicamente Imprimir prueba. No se imprimen ventas.");
 }
 public static byte[] ticket(String text){
  PrinterCore.ticket(text); // Same strict length/ASCII/control-character policy.
  byte[] body=text.getBytes(StandardCharsets.ISO_8859_1),out=new byte[body.length+6];
  out[0]=27;out[1]=64;System.arraycopy(body,0,out,2,body.length);
  System.arraycopy(cut(),0,out,body.length+2,4);return out;
 }
 public static byte[] cut(){return new byte[]{29,86,66,0};}
 public static byte[] drawer(int pin){
  if(pin!=0&&pin!=1)throw new IllegalArgumentException("Pin de gaveta inválido.");
  return new byte[]{27,64,27,112,(byte)pin,25,(byte)250};
 }
 public static boolean candidate(int cls,int sub,int protocol,int direction,int type){
  return (cls==7||cls==255)&&!(cls==255&&sub==66&&protocol==1)&&direction==0&&type==2;
 }
}
