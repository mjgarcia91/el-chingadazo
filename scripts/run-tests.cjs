const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(__dirname,'..');let failures=0;
for(const file of fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.cjs')).sort()){
 const result=cp.spawnSync(process.execPath,[path.join(root,'tests',file)],{encoding:'utf8',cwd:root});
 console.log(`${result.status===0?'PASS':'FAIL'} ${file}`);
 if(result.status!==0){failures++;console.error(result.stdout+result.stderr);}
}
process.exitCode=failures?1:0;
