package hn.chingadazo.pos;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.io.IOException;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** One atomic encrypted record. A failed decrypt is never treated as an empty vault. */
final class NativeVault implements NativeAccess.Vault {
    private static final String ALIAS="chingadazo-native-access-v1";
    private final SharedPreferences preferences;
    NativeVault(Context context) { preferences=context.getSharedPreferences("native-access-v1",Context.MODE_PRIVATE); }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if(!store.containsAlias(ALIAS)) {
            if(!create) throw new IOException("missing key");
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());
            generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS,null);
    }
    public synchronized NativeAccess.Saved load() throws IOException {
        byte[] clear=null;
        try {
            String stored=preferences.getString("sealed",null);
            if(stored==null) return NativeAccess.Saved.empty();
            if(stored.length()>50000) throw new IOException("size");
            String[] parts=stored.split(":",-1);
            if(parts.length!=3 || !parts[0].equals("1")) throw new IOException("version");
            byte[] iv=Base64.decode(parts[1],Base64.NO_WRAP);
            if(iv.length!=12) throw new IOException("iv");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(false),new GCMParameterSpec(128,iv));
            cipher.updateAAD(ALIAS.getBytes("UTF-8"));
            clear=cipher.doFinal(Base64.decode(parts[2],Base64.NO_WRAP));
            JSONObject object=new JSONObject(new String(clear,"UTF-8"));
            String cookie=object.getString("cookie"),refresh=object.getString("refresh"),uid=object.getString("uid");
            long expires=object.getLong("expires");
            if(cookie.length()>8192 || refresh.length()>8192 || uid.length()>128 || expires<0) throw new IOException("values");
            return new NativeAccess.Saved(cookie,expires,refresh,uid);
        } catch(Exception e) { throw new IOException("No se pudo leer la sesión protegida. No borres datos; solicita revisión."); }
        finally { if(clear!=null) Arrays.fill(clear,(byte)0); }
    }
    public synchronized void save(NativeAccess.Saved value) throws IOException {
        byte[] clear=null;
        try {
            JSONObject object=new JSONObject();
            object.put("cookie",value.cookie).put("expires",value.cookieExpires).put("refresh",value.refresh).put("uid",value.uid);
            clear=object.toString().getBytes("UTF-8");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,key(true)); cipher.updateAAD(ALIAS.getBytes("UTF-8"));
            String sealed="1:"+Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+
                Base64.encodeToString(cipher.doFinal(clear),Base64.NO_WRAP);
            if(!preferences.edit().putString("sealed",sealed).commit()) throw new IOException("commit");
        } catch(Exception e) { throw new IOException("No se pudo guardar la sesión protegida. No se confirmó el acceso o cierre; solicita revisión."); }
        finally { if(clear!=null) Arrays.fill(clear,(byte)0); }
    }
}
