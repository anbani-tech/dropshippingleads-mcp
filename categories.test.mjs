import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {CATEGORY_LABELS,toEnglishCategory,toChineseCategory,categoryCountsForLanguage} from './categories.mjs';
import {createCatalog,DEFAULT_DATASET_PATH,stableMerchantId} from './data.mjs';
import {createHttpServer} from './http.mjs';
import {loadHttpConfig} from './http-config.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const activeBytes=fs.readFileSync(DEFAULT_DATASET_PATH);
const activeData=JSON.parse(activeBytes);
const approvedHash='9f0504d28f199c473b5cd0675f5082170b7b9ce1da85722b948f937830be8858';

test('English public categories preserve every approved Chinese category selection and pagination',{
 skip:activeData.version!=='dsl-free-initial-20261030-local-v1'?'The separately managed initial pool is not installed in this source checkout':false
},()=>{
 assert.equal(hash(activeBytes),approvedHash);
 const catalog=createCatalog();const coverage=catalog.coverage();
 assert.equal(Object.keys(coverage.categories).length,14);
 assert(Object.values(coverage.categories).every(n=>n===100));
 assert(Object.keys(coverage.categories).every(name=>!/[\u3400-\u9fff]/.test(name)));
 assert.equal(Object.keys(coverage.categories).some(name=>/food|beverage/i.test(name)),false);
 for(const {zh,en}of CATEGORY_LABELS){
  const expected=activeData.records.filter(record=>record.categories.includes(zh)).map(record=>record.id);
  assert.equal(expected.length,100,zh);assert.equal(coverage.categories[en],expected.length,en);
  const queries=[catalog.search({category:zh,limit:50}),catalog.search({category:en,limit:50}),catalog.search({category:en.toUpperCase(),limit:50})];
  for(const result of queries){
   assert.deepEqual(result.records.map(record=>record.id),expected.slice(0,50));
   assert.equal(result.query.category,en);assert.equal(result.matched,100);assert.equal(result.next_offset,50);
   assert(result.records.every(record=>record.categories.every(name=>!/[\u3400-\u9fff]/.test(name))));
  }
  const lastZh=catalog.search({category:zh,limit:50,offset:50});
  const lastEn=catalog.search({category:en,limit:50,offset:50});
  assert.deepEqual(lastZh,lastEn);assert.deepEqual(lastEn.records.map(record=>record.id),expected.slice(50));assert.equal(lastEn.next_offset,null);
  assert.equal(catalog.search({keyword:zh}).matched,100);assert.equal(catalog.search({keyword:en.toLowerCase()}).matched,100);
  const detail=catalog.get(expected[0]).record;
  assert(detail.categories.includes(en));assert(detail.categories.every(name=>!/[\u3400-\u9fff]/.test(name)));
  const original=activeData.records.find(record=>record.id===detail.id);
  assert.deepEqual(detail.sources,original.sources);assert.equal(detail.store_url,original.store_url);assert.equal(detail.observed_at,original.observed_at);
 }
 assert.equal(hash(fs.readFileSync(DEFAULT_DATASET_PATH)),approvedHash,'Queries must not rewrite the internal dataset');
});

test('label conversion is explicit and reversible without guessing unknown category names',()=>{
 assert.equal(toEnglishCategory('服装鞋包'),'Apparel, Footwear & Bags');
 assert.equal(toChineseCategory('HOME & LIVING'),'家居家装');
 assert.equal(toEnglishCategory('未映射测试类'),'未映射测试类');
 assert.equal(toEnglishCategory('apparel'),'apparel','No partial category matching');
 assert.deepEqual(categoryCountsForLanguage({'服装鞋包':100,'家居家装':100}),{'Apparel, Footwear & Bags':100,'Home & Living':100});
 assert.deepEqual(categoryCountsForLanguage({'Apparel, Footwear & Bags':100,'Home & Living':100},'zh'),{'服装鞋包':100,'家居家装':100});
});

async function verifyEnglishProtocol(client){
 async function call(name,args={}){
  const result=await client.callTool({name,arguments:args});assert.notEqual(result.isError,true);
  assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);return result.structuredContent;
 }
 const coverage=await call('get_data_coverage');assert.deepEqual(coverage.categories,{'Apparel, Footwear & Bags':1});
 const en=await call('search_merchants',{category:'apparel, footwear & bags',limit:1});
 const zh=await call('search_merchants',{category:'服装鞋包',limit:1});
 assert.deepEqual(en,zh);assert.equal(en.query.category,'Apparel, Footwear & Bags');assert.equal(en.matched,1);
 assert.deepEqual(en.records[0].categories,['Apparel, Footwear & Bags']);
 const detail=await call('get_merchant',{id:en.records[0].id});assert.deepEqual(detail.record.categories,en.records[0].categories);
 const resource=JSON.parse((await client.readResource({uri:'dsl://public/coverage'})).contents[0].text);
 assert.deepEqual(resource.categories,coverage.categories);
 assert.match((await call('get_methodology')).purpose,/small online retailer/i);
 assert.equal((await call('search_merchants',{category:'not-a-category'})).matched,0);
}

for(const transportType of ['http','stdio'])test(`English categories and Chinese aliases work over official ${transportType} MCP transport`,{timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsl-category-protocol-'));
 const fixtureFile=path.join(dir,'catalog.json');
 const store_url='https://category-fixture.example/';
 fs.writeFileSync(fixtureFile,JSON.stringify({schemaVersion:1,status:'ready',version:'synthetic-category-test-only',release_period:'2026-Q4',published_at:'2026-10-30T00:00:00Z',records:[{id:stableMerchantId(store_url),store_url,categories:['服装鞋包'],markets:['US'],products:[],contacts:[],sources:[{url:store_url,label:'Synthetic protocol fixture only'}],observed_at:null,classification_status:'confirmed',approved_for_public:true}]}));
 const client=new Client({name:'english-category-protocol-test',version:'0.2.0'});let app;
 try{
  let transport;
  if(transportType==='http'){
   app=createHttpServer({datasetPath:fixtureFile,config:loadHttpConfig({DSL_RATE_BURST:'100'})});
   await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
   transport=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+app.server.address().port+'/mcp'));
  }else{
   transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],env:{DSL_PUBLIC_DATASET:fixtureFile},stderr:'pipe'});
  }
  await client.connect(transport);await verifyEnglishProtocol(client);
 }finally{
  await client.close();if(app)await app.close();
  fs.unlinkSync(fixtureFile);fs.rmdirSync(dir);
 }
 assert.equal(hash(fs.readFileSync(DEFAULT_DATASET_PATH)),hash(activeBytes));
});
