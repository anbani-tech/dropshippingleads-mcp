import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createCatalog,validateCatalog,stableMerchantId,DEFAULT_DATASET_PATH} from './data.mjs';
const fixture=()=>({schemaVersion:1,status:'ready',version:'synthetic-test-only',release_period:'2026-Q4',published_at:'2026-10-30T00:00:00Z',records:[
 {store_url:'https://outerwear.example/',categories:['服装'],markets:['US'],products:[{title:'示例夹克 Example jacket',url:'https://outerwear.example/products/jacket'}],contacts:[],sources:[{url:'https://outerwear.example/products/jacket'}],observed_at:null,classification_status:'confirmed',approved_for_public:true},
 {store_url:'https://homegoods.example/',categories:['家居'],markets:['GB'],products:[{title:'示例椅子 Example chair',url:'https://homegoods.example/products/chair'}],contacts:[{type:'email',value:'public@homegoods.example'}],sources:[{url:'https://homegoods.example/'}],observed_at:null,classification_status:'confirmed',approved_for_public:true}
].map(r=>({...r,id:stableMerchantId(r.store_url)}))});
test('not loaded is explicitly different from an empty search',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsl-not-ready-data-'));const p=path.join(dir,'catalog.json');
 try{
  fs.writeFileSync(p,JSON.stringify({schemaVersion:1,status:'not_ready',version:null,release_period:null,published_at:null,records:[]}));
  const c=createCatalog(p);assert.equal(c.coverage().status,'not_ready');assert.equal(c.coverage().record_count,null);assert.equal(c.search({}).matched,null);assert.equal(c.get('anything').found,null);
 }finally{if(fs.existsSync(p))fs.unlinkSync(p);fs.rmdirSync(dir);}
});
test('approved catalog filtering, pagination and evidence work without network access',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsl-public-data-'));try{const p=path.join(dir,'data.json');fs.writeFileSync(p,JSON.stringify(fixture()));const c=createCatalog(p);
 assert.equal(c.coverage().record_count,2);assert.deepEqual(c.coverage().categories,{'服装':1,'家居':1});
 const r=c.search({keyword:'夹克',category:'服装',market:'us',limit:1});assert.equal(r.matched,1);assert.equal(r.records[0].observed_at,null);assert.equal(c.get(r.records[0].id).record.id,r.records[0].id);assert.equal(c.get('missing').found,false);
 assert.equal(c.search({market:'US',category:'家居'}).matched,0);assert.equal(c.search({keyword:'nothing'}).matched,0);
 assert.equal(c.search({limit:1}).next_offset,1);assert.equal(c.search({limit:1,offset:1}).records.length,1);assert.equal(c.search({offset:2}).records.length,0);
 for(const args of [{limit:51},{offset:-1},{keyword:'x'.repeat(121)},{path:'private.sqlite'},{sql:'select *'}])assert.throws(()=>c.search(args));
 assert.equal(c.search({keyword:'public@homegoods.example'}).matched,0,'Contact channels are not searchable via keyword');
 assert.equal(JSON.stringify(c.search({})).includes('approved_for_public'),false);
}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('unreviewed or private fields cannot enter a ready public release',()=>{
 const alter=fn=>{const f=fixture();fn(f);assert.throws(()=>validateCatalog(f));};
 alter(f=>f.records[0].approved_for_public=false);alter(f=>f.records[0].classification_status='pending');alter(f=>f.records[0].categories=[]);
 alter(f=>f.records[0].notes='private');alter(f=>f.records[0].sources=[{url:'https://docs.google.com/spreadsheets/d/internal/edit'}]);
 alter(f=>f.records[0].sources=[{url:'http://127.0.0.1:8765/'}]);alter(f=>f.records[0].sources=[{url:'https://safe.example/?api_key=secret'}]);
 alter(f=>f.records[0].store_url='https://user:pass@example.com');alter(f=>f.records.push(f.records[0]));alter(f=>f.records[0].observed_at='2026-02-31T00:00:00Z');
 alter(f=>f.records[0].contacts=[{type:'email',value:'not-an-email'}]);alter(f=>f.status='not_ready');
 assert.equal(stableMerchantId('http://www.testmerchant.example/'),stableMerchantId('https://testmerchant.example/'));
});
test('validation CLI does not replace the active catalog, and rejects invalid installation',()=>{
 const before=fs.readFileSync(DEFAULT_DATASET_PATH);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsl-catalog-cli-'));try{
 const p=path.join(dir,'approved.json');fs.writeFileSync(p,JSON.stringify(fixture()));
 const check=spawnSync(process.execPath,['catalog-cli.mjs','check',p],{cwd:new URL('.',import.meta.url),encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 const invalid=fixture();invalid.records[0].classification_status='pending';fs.writeFileSync(p,JSON.stringify(invalid));
 const install=spawnSync(process.execPath,['catalog-cli.mjs','install',p],{cwd:new URL('.',import.meta.url),encoding:'utf8'});assert.equal(install.status,1);
 assert.deepEqual(fs.readFileSync(DEFAULT_DATASET_PATH),before);
}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('install switches a separate sandbox catalog and keeps its previous version',()=>{
 const before=fs.readFileSync(DEFAULT_DATASET_PATH);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsl-install-check-'));
 try{
  fs.mkdirSync(path.join(dir,'data'));fs.writeFileSync(path.join(dir,'data/catalog.json'),before);
  for(const name of ['catalog-cli.mjs','data.mjs','categories.mjs'])fs.copyFileSync(new URL(name,import.meta.url),path.join(dir,name));
  const input=path.join(dir,'candidate.json');fs.writeFileSync(input,JSON.stringify(fixture()));
  const r=spawnSync(process.execPath,[path.join(dir,'catalog-cli.mjs'),'install',input],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  assert.equal(createCatalog(path.join(dir,'data/catalog.json')).coverage().record_count,2);
  const backups=fs.readdirSync(path.join(dir,'data/backups'));assert.equal(backups.length,1);assert.deepEqual(fs.readFileSync(path.join(dir,'data/backups',backups[0])),before);
  assert.deepEqual(fs.readFileSync(DEFAULT_DATASET_PATH),before,'Active catalog must remain unchanged');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// Export a clearly marked example without installing it as live data.
fs.mkdirSync(new URL('./examples/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./examples/catalog.synthetic-example.json',import.meta.url),JSON.stringify(fixture(),null,2));
