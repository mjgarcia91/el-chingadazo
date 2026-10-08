package hn.chingadazo.pos;
import java.util.*;
public final class PrinterCoreTest {
 public static void main(String[] args) throws Exception {
  check(PrinterCore.trusted("https://el-chingadazo.magaa1825.workers.dev/personal"));
  for(String url:new String[]{"http://el-chingadazo.magaa1825.workers.dev/personal","https://el-chingadazo.magaa1825.workers.dev.evil.test/personal","https://evil.test/personal","https://el-chingadazo.magaa1825.workers.dev@evil.test/personal","file:///personal","https://el-chingadazo.magaa1825.workers.dev/personal/evil"})check(!PrinterCore.trusted(url));
  check(PrinterCore.printer(8137,8214));check(!PrinterCore.printer(8746,1));
  byte[] data=PrinterCore.ticket("Test\n");check(data[0]==27);check(data[data.length-3]==29);check(data[data.length-1]==0);
  check(Arrays.equals(PrinterCore.drawer(),new byte[]{27,64,27,112,0,25,(byte)250}));
  for(String text:new String[]{"", "bad\u001bp",new String(new char[49153]).replace('\0','x')}){
   try{PrinterCore.ticket(text);throw new AssertionError("accepted unsafe payload");}catch(IllegalArgumentException expected){}
  }
  List<Byte> bytes=new ArrayList<>();PrinterCore.write(data,(b,o,n)->{int sent=Math.min(n,2);for(int i=0;i<sent;i++)bytes.add(b[o+i]);return sent;});
  check(bytes.size()==data.length);for(int i=0;i<data.length;i++)check(bytes.get(i)==data[i]);
  final int[] calls={0};try{PrinterCore.write(data,(b,o,n)->{calls[0]++;return -1;});throw new AssertionError();}catch(java.io.IOException expected){check(calls[0]==1);}
  try{PrinterCore.write(data,(b,o,n)->0);throw new AssertionError();}catch(java.io.IOException expected){}
  System.out.println("PrinterCore: origin, device, ESC/POS, bounds, partial sends and no retry PASS");
 }
 static void check(boolean b){if(!b)throw new AssertionError();}
}
