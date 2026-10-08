package hn.chingadazo.pos;
import java.util.Arrays;
import java.nio.charset.StandardCharsets;
public final class GeckoUsbCommandsTest {
 public static void main(String[] args){
  GeckoUsbCommands.requireTestTicket("EL CHINGADAZO\n   PRUEBA-IMPRESORA   \nPrueba\n");
  for(String bad:new String[]{"VENTA-123\n", "cliente PRUEBA-IMPRESORA\n"}){
   try{GeckoUsbCommands.requireTestTicket(bad);throw new AssertionError("live receipt");}catch(IllegalArgumentException expected){}
  }
  byte[] text="PRUEBA\n".getBytes(StandardCharsets.ISO_8859_1);
  byte[] ticket=GeckoUsbCommands.ticket("PRUEBA\n");
  if(ticket.length!=text.length+6||ticket[0]!=27||ticket[1]!=64)throw new AssertionError("init");
  if(!Arrays.equals(Arrays.copyOfRange(ticket,2,ticket.length-4),text))throw new AssertionError("body");
  if(!Arrays.equals(Arrays.copyOfRange(ticket,ticket.length-4,ticket.length),new byte[]{29,86,66,0}))throw new AssertionError("cut");
  if(!Arrays.equals(GeckoUsbCommands.drawer(0),new byte[]{27,64,27,112,0,25,(byte)250}))throw new AssertionError("pin0 with reset");
  if(!Arrays.equals(GeckoUsbCommands.drawer(1),new byte[]{27,64,27,112,1,25,(byte)250}))throw new AssertionError("pin1 with reset");
  try{GeckoUsbCommands.drawer(2);throw new AssertionError();}catch(IllegalArgumentException expected){}
  for(String bad:new String[]{"", "\u001bp",new String(new char[49153]).replace('\0','a')}){
   try{GeckoUsbCommands.ticket(bad);throw new AssertionError("unsafe text");}catch(IllegalArgumentException expected){}
  }
  if(!GeckoUsbCommands.candidate(7,1,2,0,2)||!GeckoUsbCommands.candidate(255,0,0,0,2))throw new AssertionError("printer candidate");
  for(int type:new int[]{3,8,9,1})if(GeckoUsbCommands.candidate(type,0,0,0,2))throw new AssertionError("unsafe interface");
  if(GeckoUsbCommands.candidate(255,66,1,0,2)||GeckoUsbCommands.candidate(7,0,0,128,2)||GeckoUsbCommands.candidate(7,0,0,0,3))throw new AssertionError("not bulk printer output");
  System.out.println("Gecko USB: validated text, exact isolated commands and candidate filters PASS");
 }
}
