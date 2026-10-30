import fs from 'node:fs';
import path from 'node:path';
import {validateCatalog,DEFAULT_DATASET_PATH} from './data.mjs';
const [action,input]=process.argv.slice(2);
if(!['check','install'].includes(action)||!input){console.error('Usage: node catalog-cli.mjs check|install path/to/catalog.json');process.exit(2);}
try{
 const data=validateCatalog(JSON.parse(fs.readFileSync(path.resolve(input),'utf8')));
 if(action==='install'){
  if(data.status!=='ready')throw Error('Install requires a ready, reviewed catalog');
  const dir=path.dirname(DEFAULT_DATASET_PATH),backup=path.join(dir,'backups');fs.mkdirSync(backup,{recursive:true});
  if(fs.existsSync(DEFAULT_DATASET_PATH))fs.copyFileSync(DEFAULT_DATASET_PATH,path.join(backup,'catalog-'+Date.now()+'.json'),fs.constants.COPYFILE_EXCL);
  const temp=DEFAULT_DATASET_PATH+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{flag:'wx'});fs.renameSync(temp,DEFAULT_DATASET_PATH);
 }
 console.log(JSON.stringify({status:'PASS',action,catalogStatus:data.status,records:data.records.length,version:data.version,note:action==='install'?'Installed locally; restart the MCP process to activate. No deployment performed.':'Validated only; active data not changed.'}));
}catch(e){console.error('Catalog rejected: '+e.message);process.exitCode=1;}
