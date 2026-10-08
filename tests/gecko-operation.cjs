// Android wiring guards supplement (not replace) JVM and physical device tests.
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=n=>fs.readFileSync('android/gecko/src/hn/chingadazo/pos/'+n+'.java','utf8');
const usb=read('GeckoUsbTransport'),delegate=read('GeckoUsbDelegate');
const activity=read('GeckoEvaluationActivity');
assert.match(activity,/onTextPrompt\(GeckoSession s,TextPrompt prompt\)/,'cash and shift text prompts need explicit UI');
assert.match(activity,/prompt.confirm\(value\)/);
assert.match(activity,/decision.finish\(input.getText\(\).toString\(\)\)/);
assert.match(usb,/getSharedPreferences\("gecko_usb",Context.MODE_PRIVATE\)/);
assert.match(usb,/putString\("selected",candidate.key\(\)\)/);
assert.match(usb,/GeckoUsbSelection.unique/);
assert.match(usb,/putInt\("drawerPin",index\)/);
assert.match(usb,/if\(!status\(\).getBoolean\("connected"\)\)connect\(\);/);
assert.doesNotMatch(delegate,/requireTestTicket\(c.text\)/,'real validated receipts must be accepted');
assert.match(delegate,/case "print":result=usb.send\(GeckoUsbCommands.ticket\(c.text\)\);break;/);
const build=fs.readFileSync('android/gecko/build.gradle','utf8');
assert.match(build,/release\s*\{[\s\S]*debuggable false/);
assert.match(build,/versionName '1.0.0'/);
console.log('Operational APK: saved hardware, single-attempt reconnect, real receipts, release guards PASS');
