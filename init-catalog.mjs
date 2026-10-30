import fs from 'node:fs';
import {DEFAULT_DATASET_PATH} from './data.mjs';
fs.mkdirSync(new URL('./data/',import.meta.url),{recursive:true});
try{
 fs.writeFileSync(DEFAULT_DATASET_PATH,JSON.stringify({schemaVersion:1,status:'not_ready',version:null,release_period:null,published_at:null,records:[]},null,2),{flag:'wx'});
 console.log('Created an empty local catalog. Real data is not activated.');
}catch(e){if(e.code!=='EEXIST')throw e;console.log('Existing catalog preserved; no data changed.');}
