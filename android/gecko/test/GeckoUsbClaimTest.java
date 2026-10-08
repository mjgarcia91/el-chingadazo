package hn.chingadazo.pos;
/** OS boundary fake: does not claim to reproduce a physical kernel driver. */
public final class GeckoUsbClaimTest {
 static final class Fake implements GeckoUsbClaim.Claimer {
  final boolean normal,forced;int calls;boolean lastForce;
  Fake(boolean normal,boolean forced){this.normal=normal;this.forced=forced;}
  public boolean claim(boolean force){calls++;lastForce=force;return force?forced:normal;}
 }
 public static void main(String[] args){
  Fake normal=new Fake(true,true);
  if(GeckoUsbClaim.claim(7,true,normal)!=1||normal.calls!=1||normal.lastForce)throw new AssertionError("normal success must not detach");
  Fake kernel=new Fake(false,true);
  if(GeckoUsbClaim.claim(7,true,kernel)!=2||kernel.calls!=2||!kernel.lastForce)throw new AssertionError("authorized printer driver fallback");
  Fake denied=new Fake(false,true);
  if(GeckoUsbClaim.claim(7,false,denied)!=0||denied.calls!=1)throw new AssertionError("consent required");
  for(int cls:new int[]{0,1,3,8,9,255}){
   Fake other=new Fake(false,true);
   if(GeckoUsbClaim.claim(cls,true,other)!=0||other.calls!=1)throw new AssertionError("never detach non-printer");
  }
  Fake failure=new Fake(false,false);
  if(GeckoUsbClaim.claim(7,true,failure)!=0||failure.calls!=2)throw new AssertionError("failure must remain failure; no loop");
  System.out.println("Gecko USB claim: normal, authorized kernel fallback, denied/other classes and bounded failure PASS");
 }
}
