/* MID Store — API Cloudflare Worker integrada ao GitHub.
   Segredos: ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN.
   Variáveis: GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGIN.
   Suporta imageOrder para adicionar, enquadrar e remover imagens.
   Mantenha tokens e senhas SOMENTE nos segredos do Worker. */
const encoder=new TextEncoder();
const json=(value,status=200,origin='*')=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'}});
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s);}
const to64=s=>base64(encoder.encode(s));
const from64=s=>new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
function eq(a,b){const x=encoder.encode(String(a)),y=encoder.encode(String(b));let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
const b64url=b=>base64(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function signature(input,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(input))));}
async function authenticated(req,env){
  const authHeader=req.headers.get('Authorization')||'';
  const bearer=authHeader.startsWith('Bearer ')?authHeader.slice(7):'';
  const [payload,sig]=bearer.split('.');
  if(!payload||!sig||!env.SESSION_SECRET)return false;
  if(!eq(sig,await signature(payload,env.SESSION_SECRET)))return false;
  try{const pad=payload.replace(/-/g,'+').replace(/_/g,'/');const obj=JSON.parse(from64(pad));return obj.role==='admin'&&obj.exp>Date.now();}
  catch{return false;}
}
async function github(env,path,method='GET',data){
  const owner=env.GITHUB_OWNER,repo=env.GITHUB_REPO,branch=env.GITHUB_BRANCH||'main';
  if(!owner||!repo||!env.GITHUB_TOKEN)throw Error('Configuração do GitHub incompleta.');
  const subpath=path.split('/').map(encodeURIComponent).join('/');
  const url=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${subpath}?ref=${encodeURIComponent(branch)}`;
  const response=await fetch(url,{method,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MID-Store-Admin','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error('GitHub: '+(result.message||response.status));error.status=response.status;throw error;}
  return result;
}
async function loadDB(env){const file=await github(env,'products.json');return {file,db:JSON.parse(from64(file.content.replace(/\s/g,'')))};}
async function saveDB(env,db,sha){return github(env,'products.json','PUT',{message:'MID Store: atualizar catálogo',content:to64(JSON.stringify(db,null,2)),sha,branch:env.GITHUB_BRANCH||'main'});}
function validateRecord(data,db){const name=String(data.name||'').trim().slice(0,120),description=String(data.description||'').slice(0,2500),price=Number(data.price),category=String(data.category||'');
  if(!name||!Number.isFinite(price)||price<0||!db.categories.includes(category))throw Error('Produto inválido: confira nome, preço e categoria.');
  return {name,description,price,category};
}
async function saveImages(env,files,id){
  if(!Array.isArray(files)||files.length>8)throw Error('Máximo de 8 imagens por envio.');
  const paths=[];
  for(const file of files){
    const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(file?.data||'');
    if(!match)throw Error('Formato de imagem inválido.');
    if(match[2].length>6*1024*1024)throw Error('Imagem muito grande após compressão.');
    const extension=match[1]==='jpeg'?'jpg':match[1];
    const path=`images/products/${id}-${crypto.randomUUID().slice(0,8)}.${extension}`;
    await github(env,path,'PUT',{message:'MID Store: adicionar imagem',content:match[2],branch:env.GITHUB_BRANCH||'main'});
    paths.push(path);
  }
  return paths;
}
function orderImages(body,oldPaths,newPaths){
  // Compatibilidade com versões anteriores do catálogo.
  if(body.imageOrder===undefined)return [...oldPaths,...newPaths];
  if(!Array.isArray(body.imageOrder)||body.imageOrder.length>8)throw Error('Máximo de 8 imagens por produto.');
  const permitted=new Set(oldPaths),seenOld=new Set(),seenNew=new Set(),ordered=[];
  for(const item of body.imageOrder){
    if(item?.kind==='old'){
      if(typeof item.path!=='string'||!permitted.has(item.path)||seenOld.has(item.path))throw Error('Referência de imagem inválida.');
      seenOld.add(item.path);ordered.push(item.path);
    }else if(item?.kind==='new'){
      const i=item.index;
      if(!Number.isInteger(i)||i<0||i>=newPaths.length||seenNew.has(i))throw Error('Ordem de imagem inválida.');
      seenNew.add(i);ordered.push(newPaths[i]);
    }else throw Error('Dados de imagens inválidos.');
  }
  if(seenNew.size!==newPaths.length)throw Error('Uma imagem nova não foi incluída na ordem de publicação.');
  return ordered;
}
async function cleanUnlinked(env,removed,db){
  // Exclui imagens antigas do branch atual depois da atualização de products.json.
  // O histórico Git anterior pode continuar contendo esses arquivos.
  const referenced=new Set(db.products.flatMap(p=>p.images||[]));
  for(const path of removed){
    if(!/^images\/products\/[a-z0-9._-]+$/i.test(path)||referenced.has(path))continue;
    try{const info=await github(env,path);await github(env,path,'DELETE',{message:'MID Store: remover imagem não utilizada',sha:info.sha,branch:env.GITHUB_BRANCH||'main'});}
    catch(e){/* A ausência da limpeza não impede a remoção da imagem do catálogo. */}
  }
}
export default {async fetch(req,env){
  const origin=req.headers.get('Origin')||'',allowed=String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');
  const cors=origin&&origin===allowed?origin:(origin?'null':'*');
  const headers={'Access-Control-Allow-Origin':cors,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'OPTIONS, POST, PUT, DELETE, GET','Vary':'Origin'};
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  const reply=(data,status=200)=>{const r=json(data,status,cors);for(const [k,v] of Object.entries(headers))r.headers.set(k,v);return r;};
  if(origin&&origin!==allowed)return reply({error:'Origem não autorizada.'},403);
  try{
    const pathname=new URL(req.url).pathname;
    if(pathname==='/login'&&req.method==='POST'){
      if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return reply({error:'Configure as credenciais do Worker.'},503);
      const body=await req.json();
      if(!eq(body.password||'',env.ADMIN_PASSWORD))return reply({error:'Senha incorreta.'},401);
      const payload=b64url(encoder.encode(JSON.stringify({role:'admin',exp:Date.now()+12*60*60*1000})));
      return reply({token:payload+'.'+await signature(payload,env.SESSION_SECRET)});
    }
    if(!await authenticated(req,env))return reply({error:'Sessão inválida. Faça login novamente.'},401);
    if(pathname==='/products'||pathname.startsWith('/products/')){
      if(!['POST','PUT','DELETE'].includes(req.method))return reply({error:'Método inválido.'},405);
      const {db,file}=await loadDB(env);
      let id=pathname.startsWith('/products/')?decodeURIComponent(pathname.slice(10)):null;
      const index=db.products.findIndex(p=>p.id===id);
      let removed=[];
      if(req.method==='DELETE'){
        if(index<0)return reply({error:'Produto não encontrado.'},404);
        removed=[...(db.products[index].images||[])];db.products.splice(index,1);
      }else{
        const body=await req.json();
        const record=validateRecord(body,db);
        if(req.method==='PUT'&&index<0)return reply({error:'Produto não encontrado.'},404);
        if(req.method==='POST')id='mid-'+crypto.randomUUID();
        const oldImages=index>=0&&req.method==='PUT'?[...(db.products[index].images||[])]:[];
        // Validate the desired order before uploading to reject malformed requests early.
        if(body.imageOrder!==undefined){
          const dummy=(body.images||[]).map((_,i)=>'new-'+i);
          orderImages(body,oldImages,dummy);
        }
        const fresh=await saveImages(env,body.images||[],id);
        const finalImages=orderImages(body,oldImages,fresh);
        if(finalImages.length>8)throw Error('Máximo de 8 imagens por produto.');
        removed=oldImages.filter(path=>!finalImages.includes(path));
        if(req.method==='POST')db.products.unshift({id,...record,images:finalImages});
        else db.products[index]={...db.products[index],...record,images:finalImages};
      }
      await saveDB(env,db,file.sha);
      if(removed.length)await cleanUnlinked(env,removed,db);
      return reply({ok:true});
    }
    if(pathname==='/settings'&&req.method==='PUT'){
      const body=await req.json(),{db,file}=await loadDB(env);
      const settings=body.settings||{};
      const cats=Array.isArray(body.categories)?body.categories.map(x=>String(x).trim().slice(0,40)).filter(Boolean).slice(0,30):db.categories;
      db.categories=[...new Set(cats)];
      db.settings={whatsapp:String(settings.whatsapp||'').replace(/\D/g,'').slice(0,20),bannerTitle:String(settings.bannerTitle||'').slice(0,120),bannerSubtitle:String(settings.bannerSubtitle||'').slice(0,300),bannerEnabled:!!settings.bannerEnabled};
      await saveDB(env,db,file.sha);return reply({ok:true});
    }
    return reply({error:'Rota inexistente.'},404);
  }catch(e){return reply({error:e.message||'Erro interno'},e.status&&e.status>=400&&e.status<600?e.status:400);}
}};
