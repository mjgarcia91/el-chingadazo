const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/instance-config.js'), 'utf8'), context);
const config = context.CHINGADAZO_CONFIG;
const worker = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
const errors = [];
if (worker.name !== 'el-chingadazo') errors.push('El destino debe ser el-chingadazo.');
if (worker.r2_buckets?.some(x => !x.bucket_name.startsWith('el-chingadazo-'))) errors.push('Almacenamiento ajeno a El Chingadazo.');
if (/trapiche|tipicos/i.test(JSON.stringify([worker, config]))) errors.push('Se detectó configuración de otro restaurante.');
if (!config.configured || !Object.values(config.firebase).every(Boolean)) errors.push('Falta conectar el nuevo proyecto Firebase.');
if (!/^https:\/\//.test(config.publicOrigin) || /\.invalid/.test(config.publicOrigin)) errors.push('Falta la dirección pública temporal o definitiva.');
if (errors.length) { console.error('Despliegue bloqueado:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Destino independiente verificado.');
