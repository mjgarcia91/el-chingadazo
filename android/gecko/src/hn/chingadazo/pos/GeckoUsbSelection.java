package hn.chingadazo.pos;
import java.util.List;
/** Restore only an exact, unique descriptor; never guess the first attached device. */
public final class GeckoUsbSelection {
 public static int unique(String saved,List<String> keys){
  if(saved==null||saved.isEmpty())return -1;
  int found=-1;
  for(int i=0;i<keys.size();i++)if(saved.equals(keys.get(i))){if(found>=0)return -1;found=i;}
  return found;
 }
 public static int pin(int stored){return stored==1?1:0;}
}
