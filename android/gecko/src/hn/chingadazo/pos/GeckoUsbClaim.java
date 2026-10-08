package hn.chingadazo.pos;
/** Android force=true detaches a kernel driver if needed, not arbitrary app data. */
public final class GeckoUsbClaim {
 public interface Claimer {boolean claim(boolean force);}
 /** 0=failed, 1=normal, 2=kernel-driver compatibility. Never sends printer bytes. */
 public static int claim(int interfaceClass,boolean approved,Claimer connection){
  if(connection.claim(false))return 1;
  if(interfaceClass==7&&approved&&connection.claim(true))return 2;
  return 0;
 }
}
