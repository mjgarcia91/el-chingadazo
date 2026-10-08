const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const fn=name=>{const start=src.indexOf('function '+name+'(');if(start<0)throw Error('Falta '+name);const next=src.indexOf('\nfunction ',start+10);return src.slice(start,next<0?src.length:next)};
const products=[
  {id:'chuleta',name:'Chuleta típica',price:169,category:'tipicos',available:true,featured:true,modifiers:[]},
  {id:'gringas',name:'Gringas',price:149,category:'mexicana',available:true,featured:true,modifiers:[]},
  {id:'tacos',name:'Tacos',price:119,category:'mexicana',available:true,featured:true,modifiers:[]},
  {id:'torta',name:'Torta',price:110,category:'mexicana',available:true,featured:false,modifiers:[]},
  {id:'burga',name:'Hamburguesa',price:165,category:'burgas',available:true,featured:false,modifiers:[]},
  {id:'coca-personal',name:'Coca-Cola portátil',price:25,category:'refrescos',available:true,featured:false,modifiers:[]},
  {id:'coca-15',name:'Coca-Cola 1.5 L',price:45,category:'refrescos',available:true,featured:false,modifiers:[]},
  {id:'coca-2l',name:'Coca-Cola 2 L',price:55,category:'refrescos',available:true,featured:false,modifiers:[]},
  {id:'agua',name:'Agua embotellada',price:15,category:'refrescos',available:true,featured:false,modifiers:[]}
];
let seq=0;const context=vm.createContext({STATE:{smartBudget:500,smartPeople:2,smartSeed:0},Store:{get:()=>({products,orders:[],settings:{waitMin:25}}),uid:()=>`k${++seq}`},currentUser:()=>({id:'u',role:'customer'}),productById:id=>products.find(p=>p.id===id),itemUnit:p=>Number(p.price),modsLabel:()=>'',productImageUrl:p=>`assets/${p.id}.jpg`});
vm.runInContext(fn('customerOrderHistory')+'\n'+fn('defaultProductMods')+'\n'+fn('smartCartItem')+'\n'+fn('tasteWeights')+'\n'+fn('hondurasMealMoment')+'\n'+fn('smartRecommendation')+'\nglobalThis.result=smartRecommendation();globalThis.moments=[hondurasMealMoment(new Date("2026-09-12T13:00:00Z")),hondurasMealMoment(new Date("2026-09-12T18:00:00Z")),hondurasMealMoment(new Date("2026-09-12T22:00:00Z")),hondurasMealMoment(new Date("2026-09-13T02:00:00Z")),hondurasMealMoment(new Date("2026-09-13T07:00:00Z"))]',context);
const result=context.result, food=result.items.filter(i=>products.find(p=>p.id===i.productId).category!=='refrescos'), drinks=result.items.filter(i=>products.find(p=>p.id===i.productId).category==='refrescos');
assert.ok(result.total<=500);assert.ok(result.total>=490,`total ${result.total}`);assert.ok(drinks.length>=1);assert.ok(food.length>=2);assert.equal(new Set(food.map(i=>i.productId)).size,food.length);
assert.deepEqual(Array.from(context.moments,m=>m.noun),['desayuno','almuerzo','antojo','cena','antojo nocturno']);
console.log(`PASS v106: IA combina ${food.length} platos distintos, agrega refresco, usa L.${result.total} de L.500 y respeta la hora de Honduras.`);
