package hn.chingadazo.pos;

public final class WebViewDiagnosticsTest {
 public static void main(String[] args) {
  check("44.0.2403.119".equals(WebViewDiagnostics.chromium("Mozilla Chrome/44.0.2403.119 Safari/537.36")), "old active engine");
  check("106.0.5249.126".equals(WebViewDiagnostics.chromium("Chrome/106.0.5249.126")), "new engine");
  check("No identificado".equals(WebViewDiagnostics.chromium(null)), "missing UA");
  check("No identificado".equals(WebViewDiagnostics.chromium("Firefox/100")), "non Chrome");
  String report=WebViewDiagnostics.report("1.0.1", "6.0.1 / API 23", "S2802", "Chrome/44.0.2403.119", "com.android.webview: 44", "com.google.android.webview: 106");
  check(report.contains("Motor activo según User-Agent: Chromium 44.0.2403.119"), "installed 106 cannot mask active 44");
  check(report.contains("Instalado no significa activo"), "qualification");
  check(report.contains("com.google.android.webview: 106"), "installed inventory");
  System.out.println("WebView diagnostics PASS");
 }
 private static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);}
}
