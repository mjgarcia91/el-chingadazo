package hn.chingadazo.pos;

import java.util.regex.*;

/** Local technical details only: no account, sales, identifiers or network requests. */
public final class WebViewDiagnostics {
 private WebViewDiagnostics() {}
 public static String chromium(String ua) {
  Matcher m=Pattern.compile("Chrome/(\\d+(?:\\.\\d+)*)").matcher(ua==null?"":ua);
  return m.find()?m.group(1):"No identificado";
 }
 public static String report(String app,String android,String model,String ua,String system,String google) {
  return "APK: "+app+"\nAndroid: "+android+"\nModelo: "+model
   +"\n\nMotor activo según User-Agent: Chromium "+chromium(ua)
   +"\nRequisito de Caja: Chromium 100 o superior y funciones web compatibles."
   +"\n\nPaquetes consultados (Instalado no significa activo):\n"+system+"\n"+google
   +"\n\nUser-Agent original:\n"+ua
   +"\n\nEste informe no cambia el proveedor WebView ni modifica ventas. No inhabilites el WebView del sistema.";
 }
}
