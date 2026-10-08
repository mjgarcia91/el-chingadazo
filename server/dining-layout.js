// Configuration-only migration; callers persist it in the salon's existing CAS transaction.
const salon=()=>({salon:{id:'salon',name:'Salón'}});
export function flattenLayout(state) {
  if(state.layoutVersion===2)return state;
  const tables=Object.values(state.tables||{}),used=new Set();
  state.layoutBeforeFlat={zones:structuredClone(state.zones||{}),tables:Object.fromEntries(tables.map(({accountId,...configuration})=>[configuration.id,configuration]))};
  const ordered=tables.sort((a,b)=>(a.kind==='bar')-(b.kind==='bar')||a.number-b.number||a.id.localeCompare(b.id));
  const renumber=[];
  for(const table of ordered){
    if(table.kind==='table'&&Number.isInteger(table.number)&&table.number>0&&!used.has(table.number))used.add(table.number);
    else renumber.push(table);
  }
  for(const table of renumber){let n=1;while(used.has(n))n++;table.number=n;used.add(n);}
  state.tables||={};
  for(let number=1;number<=30;number++)if(!used.has(number)){
    let id='table-'+number;while(Object.hasOwn(state.tables,id))id='flat-'+id;
    state.tables[id]={id,number,active:true,accountId:''};
  }
  if(Object.keys(state.tables).length>200)throw Object.assign(Error('Hay demasiadas mesas para convertir el salón sin revisión. No se borró ninguna.'),{status:409});
  Object.values(state.tables).sort((a,b)=>a.number-b.number).forEach((table,index)=>{
    Object.assign(table,{kind:'table',zoneId:'salon',temporary:false,row:Math.floor(index/4)+1,column:index%4+1});
  });
  state.zones=salon();state.layoutVersion=2;
  return state;
}
// Operator-only down path. Run under CAS after restoring the previous application version.
// Keep current accounts, links, operation journal and all newly created tables.
export function restoreLayout(state) {
  const backup=state.layoutBeforeFlat;if(!backup)return state;
  state.zones=structuredClone(backup.zones);
  for(const [id,table] of Object.entries(state.tables)){
    if(backup.tables[id])state.tables[id]={...backup.tables[id],accountId:table.accountId||''};
    else state.zones[table.zoneId]||={id:table.zoneId,name:'Salón'};
  }
  state.layoutVersion=1;state.revision++;
  return state;
}
export function initialLayout(){
  const state=flattenLayout({schemaVersion:1,revision:0,zones:{},tables:{},accounts:{},operations:{}});
  delete state.layoutBeforeFlat;
  return state;
}
