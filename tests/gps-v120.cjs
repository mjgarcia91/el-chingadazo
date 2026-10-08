const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let success, failure, timer, cleared=0, options;
const now=Date.now();
const context={window:{},Date,navigator:{geolocation:{watchPosition:(s,e,o)=>{success=s;failure=e;options=o;return 5},clearWatch:id=>{assert.equal(id,5);cleared++}}},setTimeout:f=>{timer=f;return 1},clearTimeout:()=>{}};
vm.runInNewContext(fs.readFileSync('js/gps.js','utf8'),context);
const gps=context.window.ChingadazoGPS;
const p=(accuracy=10,timestamp=Date.now(),latitude=14)=>({timestamp,coords:{latitude,longitude:-87,accuracy}});
(async()=>{
 assert.equal(gps.sample(p(0)),null);assert.equal(gps.sample(p(5,now-60000)),null);assert.equal(gps.sample(p(5,now+60000)),null);assert.equal(gps.sample(p(5,now,91)),null);
 let pending=gps.locate();success(p(400));success(p(12));assert.equal((await pending).accuracy,12);assert.equal(cleared,1);assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);
 pending=gps.locate();success(p(120));timer();await assert.rejects(pending,/precisa/);
 pending=gps.locate();success(p(60));success(p(80));timer();assert.equal((await pending).accuracy,60);
 pending=gps.locate({maxAccuracy:30});success(p(60));timer();await assert.rejects(pending,/precisa/);
 pending=gps.locate();failure({code:1});await assert.rejects(pending,/precisa/);
 for(const file of ['index.html','personal.html','delivery/index.html'])assert(fs.readFileSync(file,'utf8').includes('/js/gps.js?v=120'));
 console.log('GPS: fresh samples, invalid coordinates, permission denial, best reading, accuracy limits and cleanup PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
