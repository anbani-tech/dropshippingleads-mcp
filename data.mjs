import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {toEnglishCategory,toChineseCategory,categoryCountsForLanguage} from './categories.mjs';

export const DEFAULT_DATASET_PATH=fileURLToPath(new URL('./data/catalog.json',import.meta.url));
const allowedRecord=['id','store_url','categories','markets','products','contacts','sources','observed_at','classification_status','approved_for_public'];
const clone=v=>structuredClone(v);
function requireCondition(condition,message){if(!condition)throw new Error(message);}
function keys(value,allowed,label){requireCondition(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');requireCondition(Object.keys(value).every(k=>allowed.includes(k)),label+' contains unsupported fields; remove private or unrecognized columns');}
function string(value,max,label){requireCondition(typeof value==='string'&&value.trim().length>0&&value.length<=max,label+' must be a non-empty bounded string');}
function date(value,label){requireCondition(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value)),label+' must be an ISO UTC timestamp');requireCondition(new Date(value).toISOString().slice(0,19)===value.slice(0,19),label+' is not a valid date');}
function publicUrl(value,label){
 string(value,2048,label);let u;try{u=new URL(value);}catch{throw Error(label+' must be an absolute public HTTP(S) URL');}
 const h=u.hostname.toLowerCase();
 requireCondition(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password,label+' must be public HTTP(S) without credentials');
 requireCondition(h.includes('.')&&!h.includes(':')&&!h.startsWith('[')&&!/^\d+\.\d+\.\d+\.\d+$/.test(h)&&!/(^|\.)(localhost|local|internal|lan|test)$/.test(h),label+' must not be a local or IP-address URL');
 requireCondition(!['docs.google.com','drive.google.com'].includes(h),label+' must not expose an internal source workbook');
 for(const k of u.searchParams.keys())requireCondition(!/token|secret|password|api.?key|authorization|signature/i.test(k),label+' must not contain credential parameters');
 return u;
}
function strings(value,max,label){requireCondition(Array.isArray(value)&&value.length<=max,label+' must be a bounded array');for(const v of value)string(v,120,label);requireCondition(new Set(value).size===value.length,label+' contains duplicates');}
export function stableMerchantId(storeUrl){const u=publicUrl(storeUrl,'store_url');const key=u.hostname.toLowerCase().replace(/^www\./,'')+(u.pathname==='/'?'':u.pathname)+u.search;return 'dsl-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,20);}
export function validateCatalog(data){
 keys(data,['schemaVersion','status','version','release_period','published_at','records'],'catalog');
 requireCondition(data.schemaVersion===1,'Unsupported schemaVersion');
 requireCondition(['ready','not_ready'].includes(data.status),'Invalid status');
 requireCondition(Array.isArray(data.records)&&data.records.length<=100000,'records must be an array with at most 100000 rows');
 if(data.status==='not_ready'){
  requireCondition(data.records.length===0,'not_ready catalog must contain no records');
  requireCondition(data.version===null&&data.release_period===null&&data.published_at===null,'not_ready release metadata must be null');
  return clone(data);
 }
 requireCondition(data.records.length>0,'ready catalog requires approved records');
 string(data.version,80,'version');requireCondition(/^\d{4}-Q[1-4]$/.test(data.release_period),'release_period must be YYYY-Q1..Q4');date(data.published_at,'published_at');
 const ids=new Set();
 for(const r of data.records){
  keys(r,allowedRecord,'record');publicUrl(r.store_url,'store_url');
  requireCondition(r.id===stableMerchantId(r.store_url),'id must match stableMerchantId(store_url)');requireCondition(!ids.has(r.id),'Duplicate merchant ID / normalized URL');ids.add(r.id);
  requireCondition(r.approved_for_public===true,'Every record must be explicitly approved_for_public');
  requireCondition(r.classification_status==='confirmed','Publish only confirmed classifications; pending rows stay outside this file');
  strings(r.categories,30,'categories');requireCondition(r.categories.length>0,'At least one confirmed category is required');strings(r.markets,40,'markets');
  requireCondition(Array.isArray(r.products)&&r.products.length<=30,'products must be a bounded array');for(const p of r.products){keys(p,['title','url'],'product');publicUrl(p.url,'product.url');if(p.title!==undefined)string(p.title,300,'product.title');}
  requireCondition(Array.isArray(r.contacts)&&r.contacts.length<=20,'contacts must be a bounded array');for(const c of r.contacts){keys(c,['type','value'],'contact');requireCondition(['email','website','facebook','instagram','linkedin','whatsapp','other_public_url'].includes(c.type),'Unsupported contact type');if(c.type==='email'){string(c.value,254,'contact.value');requireCondition(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.value),'Invalid email');}else publicUrl(c.value,'contact.value');}
  requireCondition(Array.isArray(r.sources)&&r.sources.length>=1&&r.sources.length<=20,'At least one public source is required');for(const s of r.sources){keys(s,['url','label'],'source');publicUrl(s.url,'source.url');if(s.label!==undefined)string(s.label,160,'source.label');}
  requireCondition(r.observed_at===null||typeof r.observed_at==='string','observed_at must be null or a known date');if(r.observed_at!==null)date(r.observed_at,'observed_at');
 }
 return clone(data);
}

export function createCatalog(datasetPath=process.env.DSL_PUBLIC_DATASET||DEFAULT_DATASET_PATH){
 const file=fs.readFileSync(datasetPath);requireCondition(file.length<=64*1024*1024,'Catalog is too large');const data=validateCatalog(JSON.parse(file));
 const common=()=>({scope:'public_catalog',status:data.status,dataset_version:data.version,release_period:data.release_period,published_at:data.published_at});
 const unavailable=()=>({...common(),message:'DropshippingLeads public catalog is not loaded yet. This is not a claim that no matching merchant exists.',records:[],matched:null,next_offset:null});
 function view(r){const {approved_for_public,classification_status,...publicFields}=r;return {...clone(publicFields),categories:r.categories.map(toEnglishCategory),evidence:{classification_status,observed_at:r.observed_at,verification:'recorded_sources_not_live_verified',limitations:['Sales-market labels are not company domicile.','Product listings do not establish purchasing intent.','Publication date is not observation date.']}};}
 function search(args={}){
  keys(args,['keyword','category','market','limit','offset'],'query');
  const {keyword='',category,market,limit=10,offset=0}=args;
  requireCondition(typeof keyword==='string'&&keyword.length<=120,'keyword must have at most 120 characters');
  if(category!==undefined)string(category,120,'category');if(market!==undefined)string(market,40,'market');
  requireCondition(Number.isInteger(limit)&&limit>=1&&limit<=50,'limit must be 1..50');requireCondition(Number.isInteger(offset)&&offset>=0&&offset<=100000,'offset must be 0..100000');
  if(data.status!=='ready')return unavailable();
  const q=keyword.trim().toLocaleLowerCase(),categoryName=toEnglishCategory(category);
  const found=data.records.filter(r=>(!category||r.categories.some(c=>toEnglishCategory(c)===categoryName))&&(!market||r.markets.some(m=>m.toLocaleLowerCase()===market.toLocaleLowerCase()))&&(!q||[r.store_url,...r.categories.flatMap(c=>[c,toEnglishCategory(c),toChineseCategory(c)]),...r.products.flatMap(p=>[p.title||'',p.url])].join(' ').toLocaleLowerCase().includes(q)));
  return {...common(),query:{keyword,category:categoryName??null,market:market??null,limit,offset},matched:found.length,returned:found.slice(offset,offset+limit).length,next_offset:offset+limit<found.length?offset+limit:null,records:found.slice(offset,offset+limit).map(view)};
 }
 function get(id){string(id,100,'id');if(data.status!=='ready')return {...common(),found:null,record:null,message:'Public catalog not loaded yet.'};const r=data.records.find(r=>r.id===id);return {...common(),found:!!r,record:r?view(r):null};}
 function coverage(){const categories={},markets={};for(const r of data.records){for(const x of r.categories)categories[x]=(categories[x]||0)+1;for(const x of r.markets)markets[x]=(markets[x]||0)+1;}return {...common(),record_count:data.status==='ready'?data.records.length:null,categories:categoryCountsForLanguage(categories),markets,full_business_database_count:null,all_categories_claimed:false,limits:{max_results_per_call:50},note:'Counts describe this published pool only; categories can overlap. Public categories use English names; the original Chinese names remain accepted query aliases. Daily business data collection does not mean this public release updates daily.'};}
 function methodology(){return {...common(),provider:'DropshippingLeads',purpose:'Small online retailer data for dropshipping platforms researching small, independent online retailers and e-commerce businesses for merchant acquisition. The service combines Google Search discovery with public-website crawling across Shopify, WooCommerce, other store-building platforms and custom-built websites; web-wide discovery does not claim complete coverage. The collection focus is on merchants whose business operations are based outside China, India, Türkiye and Russia. This does not mean every public record has a verified business location: recorded sales-market labels do not establish where a merchant operates. Individual company size, dropshipping use and purchasing intent are not verified by these records.',search:'Literal case-insensitive keyword matching of store URL, English and Chinese category names and recorded product text/URL. Category filters accept the published English name (case-insensitive) or its exact original Chinese alias; known response categories are normalized to English. Sales-market filters remain exact and case-insensitive. No business-location filter, live Google search, live website crawling or hidden private-database search.',usage_terms:{version:'1.0',approval_status:'owner_approved',public_effective_date:'2026-10-30',code_license:'MIT (framework code and accompanying technical materials only)',copyright_holder:'Beijing Anbani Technology Co., Ltd.',data_use:'Real free merchant records are separately licensed for internal research for your own business, retention and necessary private AI analysis. Resale or public redistribution of any records, including external APIs, MCPs or client deliverables, requires separate written permission. Private processing for permitted internal research is allowed. Preserve sources and dataset versions.',document_url:'https://dropshippingleads.com/materials/mcp/docs/FREE-DATA-TERMS.md',document_publication_status:'published'},commercial_service:'For more recent, larger or tailored data, contact the DropshippingLeads team to agree a defined data batch and quarterly pricing. Formal delivery remains by email; this MCP has no paid tier.',contact:{email:'contact@dropshippingleads.com',url:'https://dropshippingleads.com/?product=leads&view=application'},updates:'The business collects additional data daily and updates its data service quarterly. This public pool is a separately identified release; freshness is shown by its version and known record dates.',boundaries:['Only explicitly approved records with confirmed classifications are loaded.','Unknown observation dates remain null.','No private workbook links, customer notes, arbitrary SQL, outbound messaging or automatic paid access.']};}
 return {search,get,coverage,methodology};
}
