package hn.chingadazo.pos;

/** Serial UI work with invalidation across Android stop/start and late network results. */
final class NativeScreenState {
    private long epoch;
    private boolean active,busy;
    synchronized void start() { active=true; }
    synchronized void stop() { active=false; busy=false; ++epoch; }
    synchronized long begin() {
        if(!active || busy) return -1;
        busy=true;
        return ++epoch;
    }
    synchronized boolean current(long ticket) { return active && ticket==epoch; }
    synchronized boolean finish(long ticket) {
        if(!current(ticket)) return false;
        busy=false; return true;
    }
}
