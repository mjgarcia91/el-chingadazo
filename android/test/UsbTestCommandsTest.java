package hn.chingadazo.pos;
import java.util.Arrays;
import java.nio.charset.StandardCharsets;
public final class UsbTestCommandsTest {
 public static void main(String[] args) {
  byte[] print=UsbTestCommands.bytes("print");
  String text=new String(print,StandardCharsets.US_ASCII);
  if(!text.contains("PRUEBA USB - NO ES UNA VENTA"))throw new AssertionError("test label");
  if(text.indexOf(29)>=0 || text.contains("\u001bp"))throw new AssertionError("print must not cut/open");
  if(!Arrays.equals(UsbTestCommands.bytes("cut"),new byte[]{10,10,10,29,86,0}))throw new AssertionError("feed/cut only");
  if(!Arrays.equals(UsbTestCommands.bytes("drawer"),PrinterCore.drawer()))throw new AssertionError("drawer pulse");
  try {UsbTestCommands.bytes("sale");throw new AssertionError("unknown accepted");} catch(IllegalArgumentException expected){}
  System.out.println("USB test commands: independent print/cut/drawer PASS");
 }
}
