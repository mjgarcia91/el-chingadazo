package hn.chingadazo.pos;

import android.content.Context;
import android.util.AtomicFile;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.io.*;
import java.security.*;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** Private, authenticated encrypted records; atomic replacement preserves the previous draft. */
final class NativeDraftStore implements NativeDrafts.Store {
    private final String ALIAS;
    private final File directory;
    NativeDraftStore(Context context) { this(context,false); }
    NativeDraftStore(Context context,boolean releaseJournal) {
        ALIAS=releaseJournal?"chingadazo-native-releases-v1":"chingadazo-native-drafts-v1";
        directory=new File(context.getNoBackupFilesDir(),releaseJournal?"releases-v1":"drafts-v1");
    }
    NativeDraftStore(Context context,String purpose) {
        if(!"table-changes".equals(purpose)&&!"shifts".equals(purpose)&&!"payments".equals(purpose)&&!"effects".equals(purpose))throw new IllegalArgumentException("Unsupported journal");
        ALIAS="chingadazo-native-"+purpose+"-v1";directory=new File(context.getNoBackupFilesDir(),purpose+"-v1");
    }
    private AtomicFile file(String owner) throws Exception {
        if(!owner.matches("auth-[A-Za-z0-9_-]{1,128}"))throw new IOException("owner");
        if(!directory.isDirectory() && !directory.mkdirs())throw new IOException("directory");
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(owner.getBytes("UTF-8"));StringBuilder name=new StringBuilder();
        for(byte value:hash)name.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
        return new AtomicFile(new File(directory,name.toString()+".bin"));
    }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(ALIAS)) {
            if(!create)throw new IOException("key");
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS,null);
    }
    public synchronized byte[] read(String owner) throws IOException {
        try {
            AtomicFile file=file(owner);
            if(!file.getBaseFile().exists() && !new File(file.getBaseFile()+".bak").exists())return null;
            byte[] stored;
            try(InputStream in=file.openRead();ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[4096];int n;
                while((n=in.read(buffer))!=-1){if(bytes.size()+n>524400)throw new IOException("size");bytes.write(buffer,0,n);}stored=bytes.toByteArray();
            }
            if(stored.length<29 || stored[0]!=1)throw new IOException("record");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(false),new GCMParameterSpec(128,Arrays.copyOfRange(stored,1,13)));
            cipher.updateAAD((ALIAS+":"+owner).getBytes("UTF-8"));
            return cipher.doFinal(stored,13,stored.length-13);
        } catch(Exception error) { throw new IOException("No se pudo leer la cuenta protegida. No borres datos."); }
    }
    public synchronized void write(String owner,byte[] bytes) throws IOException {
        AtomicFile file=null;FileOutputStream out=null;
        try {
            if(bytes.length>524288)throw new IOException("size");
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(true));
            cipher.updateAAD((ALIAS+":"+owner).getBytes("UTF-8"));
            byte[] encrypted=cipher.doFinal(bytes);file=file(owner);out=file.startWrite();
            out.write(1);out.write(cipher.getIV());out.write(encrypted);out.getFD().sync();file.finishWrite(out);out=null;
        } catch(Exception error) {
            if(file!=null && out!=null)file.failWrite(out);
            throw new IOException("No se pudo guardar la cuenta. No se confirmó el cambio.");
        }
    }
}
