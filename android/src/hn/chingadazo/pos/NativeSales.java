package hn.chingadazo.pos;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;

/** Local estimates only. The server remains authoritative when submitting a sale. */
final class NativeSales {
    static final class Choice {
        final String id,name; final long price;
        Choice(Map<String,Object> data) throws IOException {
            id=key(data,"id"); name=text(data,"name",200); price=cents(data.containsKey("price")?data.get("price"):0,true);
        }
    }
    static final class Group {
        final String id,name; final boolean required,multi; final List<Choice> options;
        Group(Map<String,Object> data) throws IOException {
            id=key(data,"id"); name=text(data,"name",200);
            required=flag(data,"required",false); multi=flag(data,"multi",false);
            List<Choice> list=new ArrayList<>(); Set<String> ids=new HashSet<>();
            for(Object item:array(data.get("options"),100)) {
                Choice choice=new Choice(object(item));
                if(!ids.add(choice.id)) throw invalid("Opciones duplicadas."); list.add(choice);
            }
            if(required && list.isEmpty()) throw invalid("Producto sin opciones obligatorias.");
            options=Collections.unmodifiableList(list);
        }
    }
    static final class Product {
        final String id,name,category,image; final long price; final boolean available;
        final List<Group> groups;
        Product(Map<String,Object> data) throws IOException {
            id=key(data,"id"); name=text(data,"name",200); category=key(data,"category");
            price=cents(data.get("price"),false); available=flag(data,"available",true);
            image=optionalText(data,"image",2048);
            List<Group> list=new ArrayList<>(); Set<String> ids=new HashSet<>();
            for(Object item:array(data.get("modifiers"),30)) {
                Group group=new Group(object(item));
                if(!ids.add(group.id)) throw invalid("Grupos duplicados."); list.add(group);
            }
            groups=Collections.unmodifiableList(list);
        }
    }
    static final class Line {
        final String productId,name,note,modsText; final int qty; final long unit;
        final Map<String,Object> mods;
        Line(Product p,int qty,long unit,String note,String labels,Map<String,Object> mods) {
            productId=p.id; name=p.name; this.qty=qty; this.unit=unit; this.note=note; modsText=labels;
            Map<String,Object> copy=new LinkedHashMap<>();
            for(Map.Entry<String,Object> entry:mods.entrySet()) {
                Object value=entry.getValue();
                copy.put(entry.getKey(),value instanceof List?Collections.unmodifiableList(new ArrayList<>((List<?>)value)):value);
            }
            this.mods=Collections.unmodifiableMap(copy);
        }
        long total() { return unit*qty; }
    }
    static Product product(Map<String,Object> data) throws IOException { return new Product(data); }
    static Line line(Product p,int qty,Map<String,Object> input,String note) throws IOException {
        if(!p.available) throw invalid("Producto no disponible.");
        if(qty<1 || qty>50) throw invalid("Cantidad de 1 a 50.");
        if(note==null || note.trim().length()>500 || note.matches("(?s).*[<>\"`].*")) throw invalid("Nota inválida.");
        if(input==null || input.size()>p.groups.size()) throw invalid("Opciones inválidas.");
        Set<String> known=new HashSet<>(); for(Group g:p.groups)known.add(g.id);
        if(!known.containsAll(input.keySet())) throw invalid("Opción desconocida.");
        long unit=p.price; List<String> labels=new ArrayList<>(); Map<String,Object> mods=new LinkedHashMap<>();
        for(Group g:p.groups) {
            Object raw=input.get(g.id);
            List<?> selected=raw==null?Collections.emptyList():raw instanceof String?Arrays.asList(raw):array(raw,100);
            if((g.required && selected.isEmpty()) || (!g.multi && selected.size()>1)) throw invalid("Revisa "+g.name+".");
            Set<String> seen=new HashSet<>(); List<String> ids=new ArrayList<>(),names=new ArrayList<>();
            for(Object item:selected) {
                if(!(item instanceof String) || !seen.add((String)item)) throw invalid("Opciones inválidas.");
                Choice found=null; for(Choice o:g.options)if(o.id.equals(item))found=o;
                if(found==null) throw invalid("Opción desconocida.");
                unit+=found.price; ids.add(found.id); names.add(found.name);
            }
            mods.put(g.id,ids.isEmpty()||g.multi?Collections.unmodifiableList(ids):ids.get(0));
            if(!names.isEmpty()) labels.add(g.name+": "+join(names,", "));
        }
        if(unit<0 || unit>100000000L) throw invalid("Precio fuera de rango.");
        String label=join(labels," · ");
        if(label.length()>20000)throw invalid("Demasiadas opciones para guardar esta línea.");
        return new Line(p,qty,unit,note.trim(),label,mods);
    }
    static List<Line> replace(List<Line> before,int index,Line line) throws IOException {
        if(before==null || before.size()>50 || index< -1 || index>=before.size() || (index==-1 && line==null)) throw invalid("La cuenta cambió.");
        List<Line> next=new ArrayList<>(before);
        if(index==-1) { if(next.size()==50)throw invalid("Máximo 50 líneas."); next.add(line); }
        else if(line==null)next.remove(index); else next.set(index,line);
        return Collections.unmodifiableList(next);
    }
    static long total(List<Line> lines) { long result=0; for(Line line:lines)result+=line.total(); return result; }
    static String money(long cents) { return "L. "+BigDecimal.valueOf(cents,2).toPlainString(); }
    static long cents(Object raw,boolean signed) throws IOException {
        if(!(raw instanceof Number)) throw invalid("Precio inválido.");
        try {
            long value=new BigDecimal(raw.toString()).movePointRight(2).longValueExact();
            if(value>100000000L || value<(signed?-100000000L:0)) throw invalid("Precio fuera de rango.");
            return value;
        } catch(NumberFormatException|ArithmeticException e) { throw invalid("Precio inválido."); }
    }
    static boolean flag(Map<String,Object> data,String key,boolean fallback) throws IOException {
        if(!data.containsKey(key))return fallback;
        if(!(data.get(key) instanceof Boolean))throw invalid("Catálogo inválido."); return (Boolean)data.get(key);
    }
    static String key(Map<String,Object> data,String field) throws IOException {
        String value=text(data,field,150); if(!value.matches("[A-Za-z0-9_-]{1,150}"))throw invalid("Identificador inválido."); return value;
    }
    static String text(Map<String,Object> data,String field,int max) throws IOException {
        Object value=data.get(field); if(!(value instanceof String) || ((String)value).trim().isEmpty() || ((String)value).length()>max)throw invalid("Catálogo incompleto.");
        return (String)value;
    }
    static String optionalText(Map<String,Object> data,String key,int max) throws IOException {
        if(!data.containsKey(key) || "".equals(data.get(key)))return ""; return text(data,key,max);
    }
    @SuppressWarnings("unchecked") static Map<String,Object> object(Object value) throws IOException {
        if(!(value instanceof Map))throw invalid("Catálogo inválido."); return (Map<String,Object>)value;
    }
    static List<?> array(Object value,int max) throws IOException {
        if(value==null)return Collections.emptyList();
        if(!(value instanceof List) || ((List<?>)value).size()>max)throw invalid("Lista inválida."); return (List<?>)value;
    }
    private static String join(List<String> list,String separator) { StringBuilder out=new StringBuilder(); for(String value:list){if(out.length()>0)out.append(separator);out.append(value);}return out.toString(); }
    static IOException invalid(String message) { return new IOException(message); }
}
