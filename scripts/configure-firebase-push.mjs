import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { instance, assertInstance } from '../server/instance.js';

const fail=(message)=>{console.error("\nERROR: "+message);process.exit(1)};
const file=process.argv[2];
if(!file || !fs.existsSync(file)) fail("No se encontró el archivo JSON seleccionado.");
let service;
try { service=JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"")); }
catch { fail("El archivo seleccionado no contiene JSON válido."); }
for(const field of ["type","project_id","private_key_id","private_key","client_email","token_uri"]) if(!service[field]) fail(`Falta el campo ${field}. Descarga una cuenta de servicio nueva.`);
if(service.type!=="service_account") fail("El archivo no es una cuenta de servicio.");
try { assertInstance({FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(service)}); } catch(error) { fail(error.message); }

const b64=value=>Buffer.from(typeof value==="string"?value:JSON.stringify(value)).toString("base64url");
let assertion;
try {
  const now=Math.floor(Date.now()/1000);
  const unsigned=b64({alg:"RS256",typ:"JWT",kid:service.private_key_id})+"."+b64({iss:service.client_email,sub:service.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:service.token_uri,iat:now,exp:now+3500});
  assertion=unsigned+"."+crypto.sign("RSA-SHA256",Buffer.from(unsigned),service.private_key).toString("base64url");
} catch { fail("La clave privada del archivo está dañada o no tiene formato RSA válido."); }

console.log("Comprobando la firma directamente con Google...");
const tokenResponse=await fetch(service.token_uri,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
const tokenBody=await tokenResponse.json().catch(()=>({}));
if(!tokenResponse.ok || !tokenBody.access_token) fail(`Google rechazó esta clave (${tokenBody.error||tokenResponse.status}): ${tokenBody.error_description||"sin detalle"}. Genera y descarga una clave NUEVA.`);

console.log("Comprobando Firebase Cloud Messaging API...");
const fcmResponse=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(service.project_id)}/messages:send`,{method:"POST",headers:{Authorization:`Bearer ${tokenBody.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({message:{token:"validation-only-not-a-device",data:{test:"1"}}})});
const fcmBody=await fcmResponse.json().catch(()=>({}));
if(fcmResponse.status===401 || fcmResponse.status===403 || fcmResponse.status===404) fail(`Firebase Cloud Messaging no está habilitado o la cuenta no tiene permiso (${fcmBody?.error?.message||fcmResponse.status}).`);

console.log("Firma y permisos correctos. Guardando el secreto en Cloudflare...");
const secretInput=JSON.stringify(service)+"\n";
const saved=process.platform==="win32"
  ? spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c","npx.cmd wrangler@latest secret put FIREBASE_SERVICE_ACCOUNT_JSON"],{input:secretInput,stdio:["pipe","inherit","inherit"],windowsHide:false})
  : spawnSync("npx",["wrangler@latest","secret","put","FIREBASE_SERVICE_ACCOUNT_JSON"],{input:secretInput,stdio:["pipe","inherit","inherit"],shell:false});
if(saved.error) fail(`No se pudo iniciar Wrangler (${saved.error.code||saved.error.message}).`);
if(saved.status!==0) fail(`Cloudflare no pudo guardar la cuenta de servicio (salida ${saved.status??"desconocida"}).`);
console.log("\nCUENTA DE SERVICIO VERIFICADA Y GUARDADA CORRECTAMENTE.");
