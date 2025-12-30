"use strict";(()=>{var e={};e.id=190,e.ids=[190],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2794:(e,a,n)=>{n.r(a),n.d(a,{originalPathname:()=>h,patchFetch:()=>y,requestAsyncStorage:()=>m,routeModule:()=>c,serverHooks:()=>g,staticGenerationAsyncStorage:()=>k});var t={};n.r(t),n.d(t,{OPTIONS:()=>p,POST:()=>d,runtime:()=>u});var r=n(9303),i=n(8716),s=n(670),o=n(4664),l=n(9665);let u="nodejs";function p(){return(0,o.U1)()}async function d(e){console.log("Enhancement endpoint called");try{if(!process.env.OPENAI_API_KEY?.trim()||!l.fr)return(0,o.wE)({error:"missing_api_key",message:"OpenAI API key tidak dikonfigurasi"},500);let{title:a,description:n,category:t,tags:r=[],price:i=0}=await (0,o.zr)(e)||{};if(!a||!n||!t)return(0,o.wE)({error:"validation_error",message:"Title, description, dan category wajib diisi untuk enhancement"},400);let s=`Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Buatkan judul yang menarik, SEO-friendly, dan persuasif untuk produk berikut:

Kategori: ${t}
Judul asli: ${a}
Deskripsi: ${n}
${r.length>0?`Tag: ${r.join(", ")}`:""}

Buatkan 1 judul yang:
- Maksimal 60 karakter
- Menarik perhatian pembeli
- Mengandung kata kunci penting
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau clickbait

Jawab HANYA dengan judul yang dihasilkan, tanpa penjelasan tambahan.`,u=`Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Tuliskan deskripsi produk yang menarik, informatif, dan persuasif berdasarkan informasi berikut:

Kategori: ${t}
Judul: ${a}
Deskripsi asli: ${n}
${r.length>0?`Tag: ${r.join(", ")}`:""}
${i>0?`Harga: Rp ${parseInt(i,10).toLocaleString("id-ID")}`:"Harga: Gratis"}

Buatkan deskripsi yang:
- Maksimal 500 karakter
- Menjelaskan kondisi, ukuran, dan detail produk dengan jelas
- Menyebutkan manfaat dan nilai produk
- Menggunakan bahasa yang ramah dan profesional
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau menipu

Jawab HANYA dengan deskripsi yang dihasilkan, tanpa penjelasan tambahan.`,p=`Berdasarkan informasi produk berikut, buatkan 3-5 tag yang relevan untuk memudahkan pencarian:

Kategori: ${t}
Judul: ${a}
Deskripsi: ${n}
${r.length>0?`Tag yang sudah ada: ${r.join(", ")}`:""}

Buatkan tag yang:
- Relevan dengan produk
- Populer untuk pencarian
- Maksimal 1-2 kata per tag
- Dalam bahasa Indonesia atau bahasa umum

Jawab dalam format JSON array: ["tag1", "tag2", "tag3"]
HANYA return JSON array, tanpa penjelasan tambahan.`,[d,c,m]=await Promise.all([l.fr.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:"Kamu adalah copywriter profesional untuk marketplace."},{role:"user",content:s}],temperature:.7,max_tokens:100}),l.fr.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:"Kamu adalah copywriter profesional untuk marketplace."},{role:"user",content:u}],temperature:.7,max_tokens:300}),l.fr.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:"Kamu adalah ahli SEO dan tagging untuk marketplace."},{role:"user",content:p}],temperature:.8,max_tokens:150})]),k=d.choices?.[0]?.message?.content?.trim()||a,g=c.choices?.[0]?.message?.content?.trim()||n,h=[...r];try{let e=m.choices?.[0]?.message?.content?.trim()||"[]",a=JSON.parse(e);Array.isArray(a)&&(h=[...new Set([...r,...a])])}catch{let e=(m.choices?.[0]?.message?.content?.trim()||"").replace(/[\[\]"]/g,"").split(",").map(e=>e.trim()).filter(e=>e.length>0);e.length>0&&(h=[...new Set([...r,...e])])}return h=h.slice(0,10),(0,o.wE)({success:!0,enhanced:{title:k,description:g,tags:h},original:{title:a,description:n,tags:r}})}catch(e){if(console.error("Error enhancing listing:",e),e?.status===429)return(0,o.wE)({error:"rate_limit",message:"Terlalu banyak permintaan ke AI. Silakan coba lagi nanti."},429);if(e?.message?.includes("API key")||e?.message?.includes("Missing credentials"))return(0,o.wE)({error:"missing_api_key",message:"OpenAI API key tidak valid"},500);return(0,o.wE)({error:"enhancement_error",message:e?.message||"Terjadi kesalahan saat melakukan enhancement"},500)}}let c=new r.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/marketplace/enhance-listing/route",pathname:"/api/marketplace/enhance-listing",filename:"route",bundlePath:"app/api/marketplace/enhance-listing/route"},resolvedPagePath:"D:\\Semester 3\\FSD\\SampahKuPilah - Copy\\SampahKuPilah\\app\\api\\marketplace\\enhance-listing\\route.js",nextConfigOutput:"",userland:t}),{requestAsyncStorage:m,staticGenerationAsyncStorage:k,serverHooks:g}=c,h="/api/marketplace/enhance-listing/route";function y(){return(0,s.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:k})}},9303:(e,a,n)=>{e.exports=n(517)},4664:(e,a,n)=>{n.d(a,{U1:()=>i,wE:()=>r,zr:()=>s});let t={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-User-Email"};function r(e,a=200,n={}){return new Response(JSON.stringify(e),{status:a,headers:{"Content-Type":"application/json",...t,...n}})}function i(){return new Response(null,{status:204,headers:t})}async function s(e){try{return await e.json()}catch{return null}}},9665:(e,a,n)=>{n.d(a,{JA:()=>s,fr:()=>i});var t=n(8820);let r=process.env.OPENAI_API_KEY?.trim()||"";process.env.OPENAI_MODEL?.trim();let i=r?new t.ZP({apiKey:r}):null;function s(){return r?!function(e){if(!e)return!1;let a=e.toLowerCase();return a.includes("your_")||a.includes("example")||a.includes("placeholder")||e.length<20}(r)?{ok:!0}:{ok:!1,error:"invalid_api_key",message:"OpenAI API key tidak valid atau masih placeholder. Edit file .env dengan API key yang valid"}:{ok:!1,error:"missing_api_key",message:"OpenAI API key tidak dikonfigurasi. Pastikan OPENAI_API_KEY sudah diset di file .env"}}}};var a=require("../../../../webpack-runtime.js");a.C(e);var n=e=>a(a.s=e),t=a.X(0,[948,209],()=>n(2794));module.exports=t})();