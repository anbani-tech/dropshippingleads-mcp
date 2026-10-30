// Public category names and Chinese query aliases. This module never rewrites data.
export const CATEGORY_LABELS=Object.freeze([
 ['服装鞋包','Apparel, Footwear & Bags'],
 ['家居家装','Home & Living'],
 ['美妆个护','Beauty & Personal Care'],
 ['健康保健','Health & Wellness'],
 ['宠物用品','Pet Supplies'],
 ['母婴玩具','Baby, Kids & Toys'],
 ['数码家电','Electronics & Home Appliances'],
 ['运动户外','Sports & Outdoors'],
 ['医疗器械','Medical Devices'],
 ['礼品文娱','Gifts & Entertainment'],
 ['综合其他','General & Other'],
 ['珠宝钟表','Jewelry & Watches'],
 ['汽车用品','Automotive Supplies'],
 ['五金园艺','Tools, Hardware & Garden']
].map(([zh,en])=>Object.freeze({zh,en})));
const byChinese=new Map(CATEGORY_LABELS.map(item=>[item.zh,item]));
const byEnglish=new Map(CATEGORY_LABELS.map(item=>[item.en.toLowerCase(),item]));

export function resolveCategory(value){
 if(typeof value!=='string')return undefined;
 return byChinese.get(value)||byEnglish.get(value.toLowerCase());
}

// Unknown values are retained, not guessed or silently assigned to another category.
// A future public category requires an explicit translation before publication.
export const toEnglishCategory=value=>resolveCategory(value)?.en??value;
export const toChineseCategory=value=>resolveCategory(value)?.zh??value;
export function categoryCountsForLanguage(counts,language='en'){
 if(!['en','zh'].includes(language))throw Error('Category language must be en or zh');
 const label=language==='en'?toEnglishCategory:toChineseCategory;
 const result=new Map();
 for(const [name,count]of Object.entries(counts)){
  const key=label(name);result.set(key,(result.get(key)||0)+count);
 }
 return Object.fromEntries(result);
}
