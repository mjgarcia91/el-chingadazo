package hn.chingadazo.pos;

import java.io.IOException;
import java.util.*;

final class NativeCatalog {
    final List<NativeSales.Product> products;
    final Map<String,String> categories;
    private NativeCatalog(List<NativeSales.Product> products,Map<String,String> categories) {
        this.products=Collections.unmodifiableList(products); this.categories=Collections.unmodifiableMap(categories);
    }
    static NativeCatalog fetch(NativeAccess.Wire wire) throws IOException {
        Map<String,Object> products=get(wire,NativeAccess.Endpoint.PRODUCTS);
        return parse(products,get(wire,NativeAccess.Endpoint.CATEGORIES));
    }
    private static Map<String,Object> get(NativeAccess.Wire wire,NativeAccess.Endpoint endpoint) throws IOException {
        NativeAccess.Reply reply=wire.send(new NativeAccess.Request(endpoint,NativeAccess.map(),"",""));
        if(reply==null || reply.status!=200 || reply.body==null)throw new IOException("No se pudo cargar el catálogo. Conserva la cuenta y vuelve a intentar.");
        return reply.body;
    }
    static NativeCatalog parse(Map<String,Object> rawProducts,Map<String,Object> rawCategories) throws IOException {
        if(rawProducts==null||rawCategories==null||rawProducts.size()>1000||rawCategories.size()>100)throw NativeSales.invalid("Catálogo demasiado grande o inválido.");
        Map<String,String> categories=new LinkedHashMap<>();
        for(Object raw:rawCategories.values()) {
            Map<String,Object> item=NativeSales.object(raw); String id=NativeSales.key(item,"id");
            if(categories.put(id,NativeSales.text(item,"name",200))!=null)throw NativeSales.invalid("Categoría duplicada.");
        }
        List<NativeSales.Product> products=new ArrayList<>(); Set<String> ids=new HashSet<>();
        for(Object raw:rawProducts.values()) {
            NativeSales.Product product=NativeSales.product(NativeSales.object(raw));
            if(!ids.add(product.id)||!categories.containsKey(product.category))throw NativeSales.invalid("Catálogo inconsistente; revisa las categorías.");
            products.add(product);
        }
        return new NativeCatalog(products,categories);
    }
}
