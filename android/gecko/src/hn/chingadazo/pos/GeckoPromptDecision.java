package hn.chingadazo.pos;
import java.util.concurrent.atomic.AtomicBoolean;
/** A prompt settles once; callers interpret cancellation without authorizing an action. */
public final class GeckoPromptDecision<T> {
 public interface Sink<T> { void accept(T value); }
 private final AtomicBoolean settled=new AtomicBoolean();
 private final Sink<T> sink;
 public GeckoPromptDecision(Sink<T> sink){this.sink=sink;}
 public void finish(T value){if(settled.compareAndSet(false,true))sink.accept(value);}
}
