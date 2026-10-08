package hn.chingadazo.pos;

public final class NativeScreenStateTest {
    static void check(boolean value) { if(!value) throw new AssertionError(); }
    public static void main(String[] args) {
        NativeScreenState state=new NativeScreenState();
        check(state.begin()==-1);
        state.start(); long old=state.begin(); check(old>=0);
        check(state.begin()==-1); // Double tap.
        state.stop(); check(!state.current(old));
        state.start(); long fresh=state.begin(); check(fresh>old); // No frozen busy flag.
        check(!state.finish(old)); check(state.current(fresh));
        check(state.finish(fresh)); check(state.begin()>fresh);
        System.out.println("Native screen resume/stale callbacks PASS");
    }
}
