const CACHE='mid-store-v7-enquadramento-imagens';
const SHELL=['./','./index.html','./styles.css','./app.js','./photo-picker-fix.js','./config.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
  const path=new URL(request.url).pathname;
  const isProductData=path.endsWith('/products.json');
  const isShell=SHELL.some(p=>new URL(p,self.registration.scope).pathname===path);
  if(isProductData||isShell){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
      return response;
    }).catch(async()=>await caches.match(request)||new Response('Sem conexão.',{status:503})));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
    return response;
  })));
});
