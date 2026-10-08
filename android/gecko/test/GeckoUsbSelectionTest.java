package hn.chingadazo.pos;
import java.util.Arrays;
public final class GeckoUsbSelectionTest {
 public static void main(String[] args){
  String saved="8137:8214:0:0:7:1:2:1:2:64";
  if(GeckoUsbSelection.unique(saved,Arrays.asList("other",saved))!=1)throw new AssertionError("restore exact descriptor");
  if(GeckoUsbSelection.unique(saved,Arrays.asList(saved,saved))!=-1)throw new AssertionError("ambiguous devices must require selection");
  if(GeckoUsbSelection.unique(saved,Arrays.asList("8137:8214:1:0:7:1:2:1:2:64"))!=-1)throw new AssertionError("changed interface");
  if(GeckoUsbSelection.unique("",Arrays.asList(saved))!=-1)throw new AssertionError("no automatic first-device selection");
  if(GeckoUsbSelection.pin(99)!=0||GeckoUsbSelection.pin(0)!=0||GeckoUsbSelection.pin(1)!=1)throw new AssertionError("safe pin defaults");
  System.out.println("USB saved selection: exact/absent/ambiguous/changed and pin defaults PASS");
 }
}
