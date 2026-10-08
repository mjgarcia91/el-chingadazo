package hn.chingadazo.pos;
public final class GeckoPromptDecisionTest {
 public static void main(String[] args){
  for(Boolean choice:new Boolean[]{true,false,null}){
   final int[] calls={0};final Boolean[] value={null};
   GeckoPromptDecision<Boolean> decision=new GeckoPromptDecision<>(v->{calls[0]++;value[0]=v;});
   if(calls[0]!=0)throw new AssertionError("must await user");
   decision.finish(choice);decision.finish(true);decision.finish(false);
   if(calls[0]!=1||value[0]!=choice)throw new AssertionError("exactly one explicit outcome");
  }
  for(String choice:new String[]{"", "189.00", null}){
   final int[] calls={0};final String[] value={null};
   GeckoPromptDecision<String> decision=new GeckoPromptDecision<>(v->{calls[0]++;value[0]=v;});
   if(calls[0]!=0)throw new AssertionError("text must await user");
   decision.finish(choice);decision.finish("999");decision.finish(null);
   if(calls[0]!=1||value[0]!=choice)throw new AssertionError("text outcome settles once");
  }
  System.out.println("Gecko prompts: explicit accept/text/cancel/navigation settle once PASS");
 }
}
