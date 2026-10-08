package hn.chingadazo.pos;
final class NativeImagePath {
    static String asset(String value){
        if(value==null)return "";
        String path=value.startsWith("/")?value.substring(1):value;
        if(path.startsWith(PrinterCore.ORIGIN+"/"))path=path.substring(PrinterCore.ORIGIN.length()+1);
        return path.matches("assets/menu/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)")?path.substring(7):"";
    }
}
