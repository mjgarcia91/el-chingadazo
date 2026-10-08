package hn.chingadazo.pos;
import android.app.*;
import android.text.*;
import android.view.View;
import android.widget.*;
import java.io.IOException;
import java.util.*;

final class NativeLineEditor {
    interface Save { void run(NativeSales.Line line); }
    static void show(Activity activity,NativeSales.Product product,NativeSales.Line before,Save save) {
        int touch=Math.round(48*activity.getResources().getDisplayMetrics().density);
        LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(touch/3,touch/6,touch/3,touch/6);
        EditText qty=field(activity,form,"Cantidad",InputType.TYPE_CLASS_NUMBER,2);
        qty.setText(before==null?"1":String.valueOf(before.qty));
        EditText note=field(activity,form,"Nota para cocina",InputType.TYPE_CLASS_TEXT,500);note.setText(before==null?"":before.note);
        Map<String,List<CompoundButton>> choices=new LinkedHashMap<>();
        for(NativeSales.Group group:product.groups) {
            TextView caption=new TextView(activity);caption.setText(group.name+(group.required?" · obligatorio":""));form.addView(caption);
            LinearLayout options=group.multi?new LinearLayout(activity):new RadioGroup(activity);options.setOrientation(LinearLayout.VERTICAL);form.addView(options);
            List<CompoundButton> buttons=new ArrayList<>();choices.put(group.id,buttons);
            if(!group.multi && !group.required){RadioButton none=new RadioButton(activity);none.setText("Sin opción");none.setId(View.generateViewId());options.addView(none);none.setChecked(true);}
            for(NativeSales.Choice choice:group.options) {
                CompoundButton button=group.multi?new CheckBox(activity):new RadioButton(activity);button.setId(View.generateViewId());
                button.setText(choice.name+" · "+NativeSales.money(choice.price));button.setTag(choice.id);button.setMinHeight(touch);options.addView(button);buttons.add(button);
                Object raw=before==null?null:before.mods.get(group.id);
                button.setChecked(choice.id.equals(raw)||(raw instanceof List && ((List<?>)raw).contains(choice.id)));
            }
        }
        TextView error=new TextView(activity);error.setTextColor(0xffb00020);error.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);form.addView(error);
        ScrollView scroll=new ScrollView(activity);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(activity).setTitle(product.name).setView(scroll).setNegativeButton("Cancelar",null).setPositiveButton("Guardar",null).create();
        dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            try {
                Map<String,Object> mods=new LinkedHashMap<>();
                for(Map.Entry<String,List<CompoundButton>> entry:choices.entrySet()){List<String> ids=new ArrayList<>();for(CompoundButton button:entry.getValue())if(button.isChecked())ids.add((String)button.getTag());mods.put(entry.getKey(),ids);}
                NativeSales.Line line=NativeSales.line(product,Integer.parseInt(qty.getText().toString()),mods,note.getText().toString());save.run(line);dialog.dismiss();
            }catch(NumberFormatException e){error.setText("Cantidad de 1 a 50.");}catch(IOException e){error.setText(e.getMessage());}
        }));dialog.show();
    }
    private static EditText field(Activity activity,LinearLayout parent,String label,int type,int max) {
        TextView caption=new TextView(activity);caption.setText(label);parent.addView(caption);
        EditText field=new EditText(activity);field.setId(View.generateViewId());caption.setLabelFor(field.getId());field.setInputType(type);field.setSingleLine(true);field.setSaveEnabled(false);
        field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(max)});parent.addView(field);return field;
    }
}
