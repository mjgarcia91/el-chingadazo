package hn.chingadazo.pos;
import android.graphics.*;
import android.widget.ImageView;
import android.view.View;
import android.content.res.AssetManager;
import android.util.LruCache;
import java.io.*;
import java.util.concurrent.*;
/** Packaged menu pictures only: no credentials, redirects or network image fetches. */
final class NativePictures {
    private static final LruCache<String,Bitmap> CACHE=new LruCache<String,Bitmap>(4*1024*1024){protected int sizeOf(String key,Bitmap value){return value.getByteCount();}};
    private static final ThreadPoolExecutor IO=new ThreadPoolExecutor(2,2,30,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(64),new ThreadPoolExecutor.DiscardPolicy());
    static void bind(ImageView view,String image){
        String path=NativeImagePath.asset(image);view.setTag(path);view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        if(path.isEmpty()){view.setVisibility(View.GONE);return;}
        Bitmap cached=CACHE.get(path);if(cached!=null){view.setImageBitmap(cached);return;}
        AssetManager assets=view.getContext().getApplicationContext().getAssets();
        IO.execute(()->{
            Bitmap bitmap=null;
            try{
                BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
                try(InputStream in=assets.open(path)){BitmapFactory.decodeStream(in,null,options);}
                if(options.outWidth<1||options.outHeight<1||options.outWidth>12000||options.outHeight>12000)throw new IOException("image size");
                options.inSampleSize=1;while(options.outWidth/options.inSampleSize>360||options.outHeight/options.inSampleSize>240)options.inSampleSize*=2;
                options.inJustDecodeBounds=false;options.inPreferredConfig=Bitmap.Config.RGB_565;
                try(InputStream in=assets.open(path)){bitmap=BitmapFactory.decodeStream(in,null,options);}
                if(bitmap!=null)CACHE.put(path,bitmap);
            }catch(IOException|RuntimeException ignored){}
            final Bitmap result=bitmap;view.post(()->{if(!path.equals(view.getTag()))return;if(result==null)view.setVisibility(View.GONE);else view.setImageBitmap(result);});
        });
    }
}
