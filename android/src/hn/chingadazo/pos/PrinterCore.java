package hn.chingadazo.pos;
import java.net.URI;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Pure policy/encoding; test without Android or a physical printer. */
public final class PrinterCore {
 public static final String ORIGIN="https://el-chingadazo.magaa1825.workers.dev";
 public static boolean trusted(String value){
  try{URI u=new URI(value);return "https".equals(u.getScheme()) && "el-chingadazo.magaa1825.workers.dev".equals(u.getHost()) && u.getUserInfo()==null && (u.getPort()==-1||u.getPort()==443) && ("/personal".equals(u.getPath())||"/personal.html".equals(u.getPath()));}
  catch(Exception e){return false;}
 }
 public static boolean printer(int vendor,int product){return vendor==8137 && product==8214;}
 public static byte[] ticket(String text){
  if(text==null||text.isEmpty()||text.length()>49152)throw new IllegalArgumentException("Ticket vacío o demasiado grande (máximo 48 KiB).");
  for(int i=0;i<text.length();i++){char c=text.charAt(i);if(c!='\n'&&(c<32||c>126))throw new IllegalArgumentException("El ticket contiene caracteres de control no permitidos.");}
  byte[] body=text.getBytes(StandardCharsets.US_ASCII),out=new byte[body.length+8];
  byte[] init={27,64,27,97,0};System.arraycopy(init,0,out,0,5);System.arraycopy(body,0,out,5,body.length);
  out[out.length-3]=29;out[out.length-2]=86;out[out.length-1]=0;return out;
 }
 public static byte[] drawer(){return new byte[]{27,64,27,112,0,25,(byte)250};}
 public interface Sender {int send(byte[] bytes,int offset,int count) throws IOException;}
 public static void write(byte[] bytes,Sender sender) throws IOException {
  long start=System.nanoTime();
  for(int offset=0;offset<bytes.length;){
   if((System.nanoTime()-start)/1000000>15000)throw new IOException("Tiempo USB agotado. Comprueba el papel/gaveta antes de reintentar; no vuelvas a cobrar.");
   int count=Math.min(2048,bytes.length-offset),sent=sender.send(bytes,offset,count);
   if(sent<=0||sent>count)throw new IOException("Envío USB interrumpido; resultado incierto. Comprueba el papel/gaveta antes de reintentar; no vuelvas a cobrar.");
   offset+=sent;
  }
 }
}
