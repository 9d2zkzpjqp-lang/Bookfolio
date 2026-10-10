// Bookfolio 0.8.0-rc7: versioned URLs + network-first documents/scripts/styles.
// A new index.html must never run with an older metadata.js/app.js.
const CACHE='bookfolio-v080-rc7';
const CORE=[
 './','./index.html','./styles.css?v=0.8.0-rc7',
 './app.js?v=0.8.0-rc7','./metadata.js?v=0.8.0-rc7','./apple-books.js?v=0.8.0-rc7',
 './quote-parser.js?v=0.8.0-rc7','./config.js?v=0.8.0-rc7',
 './manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'
];
const SCOPE_PATH=new URL(self.registration.scope).pathname;
self.addEventListener('install', event => event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(CORE);
 await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('bookfolio-')&&name!==CACHE).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE_PATH))return;
 const networkFirst=request.mode==='navigate'||/\.(?:html|js|css)$/.test(url.pathname);
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const fallback=()=>caches.match(request).then(hit=>hit||(request.mode==='navigate'?caches.match('./index.html'):Response.error()));
  if(networkFirst){
   try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok)await cache.put(request,response.clone());
    return response;
   }catch{return fallback();}
  }
  const stored=await caches.match(request);
  if(stored)return stored;
  try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}
  catch{return fallback();}
 })());
});
