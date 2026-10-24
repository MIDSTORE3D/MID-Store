(()=>{'use strict';const view=document.querySelector('#view');const cfg=window.MID_CONFIG||{};let db={categories:[],products:[],settings:{}},token=sessionStorage.getItem('mid_admin_token')||'',editorId=null,category='Todos',query='';const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const toast=t=>{let x=document.querySelector('#toast');x.textContent=t;x.style.display='block';clearTimeout(x._t);x._t=setTimeout(()=>x.style.display='none',3200)};const path=()=>location.hash.replace(/^#\/?/,'').split('?')[0];const product=id=>db.products.find(p=>p.id===id);const photo=p=>(p?.images||[])[0]||'icon.svg';const getVariants=p=>Array.isArray(p?.variants)?p.variants.filter(v=>v&&String(v.label||'').trim()&&Number.isFinite(Number(v.price))&&Number(v.price)>=0).map(v=>({label:String(v.label).trim(),price:Number(v.price)})):[];
const displayPrice=p=>{const variants=getVariants(p);return variants.length?Math.min(...variants.map(v=>v.price)):Number(p.price||0)};
function whatsapp(p,variation){let phone=String(db.settings.whatsapp||'').replace(/\D/g,'');if(!phone){toast('WhatsApp ainda não configurado pela loja.');return}let price=variation?variation.price:displayPrice(p);let msg=`Olá! Vi o produto ${p.name} (${money(price)}) no catálogo MID Store e gostaria de saber mais.`;if(variation)msg+=`\nTamanho/opção: ${variation.label}\nPreço da opção: ${money(price)}`;window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer')};
const catButtons=(chosen)=>['Todos',...db.categories].map(c=>`<button class="pill ${chosen===c?'active':''}" data-cat="${escape(c)}">${escape(c)}</button>`).join('');const card=p=>`<article class="product" data-id="${escape(p.id)}"><img loading="lazy" src="${escape(photo(p))}" alt="${escape(p.name)}"><div class="copy"><span class="category">${escape(p.category)}</span><h3>${escape(p.name)}</h3><strong class="price">${getVariants(p).length?'<span class="from-label">A partir de </span>':''}${money(displayPrice(p))}</strong></div></article>`;function hero(){return db.settings.bannerEnabled===false?'':`<section class="hero"><div><span class="eyebrow">Bem-vindo à MID Store</span><h1>${escape(db.settings.bannerTitle||'Feito para surpreender.')}</h1><p>${escape(db.settings.bannerSubtitle||'Peças criativas e detalhes que fazem a diferença.')}</p><a href="#/catalogo" class="btn primary">Explorar catálogo →</a></div></section>`};function home(){view.innerHTML=hero()+`<section class="sectionhead"><div><h2>Encontre seu estilo</h2><p>Descubra nossas categorias</p></div></section><div class="categories">${catButtons(category)}</div><section class="sectionhead"><div><h2>Produtos em destaque</h2><p>Escolhas que fazem a diferença</p></div><a href="#/catalogo">Ver todos →</a></section><div class="grid">${db.products.slice(0,8).map(card).join('')}</div>`;bindCards();bindCats()};function catalog(){let arr=db.products.filter(p=>(category==='Todos'||p.category===category)&&(!query||[p.name,p.description,p.category].join(' ').toLowerCase().includes(query.toLowerCase())));view.innerHTML=`<div class="sectionhead"><div><h2>Nosso catálogo</h2><p>${db.products.length} produtos · consulte diretamente pelo WhatsApp</p></div></div><div class="filters"><input class="search" id="search" placeholder="Buscar produtos…" value="${escape(query)}" autocomplete="off"></div><div class="categories">${catButtons(category)}</div><div id="results">${arr.length?`<div class="grid">${arr.map(card).join('')}</div>`:'<div class="empty">Nenhum produto encontrado.</div>'}</div>`;document.querySelector('#search').oninput=e=>{query=e.target.value;catalog();let el=document.querySelector('#search');el.focus();el.setSelectionRange(query.length,query.length)};bindCards();bindCats()};function detail(id){
 let p=product(id);
 if(!p){view.innerHTML='<div class="empty">Produto não encontrado. <a href="#/catalogo">Voltar ao catálogo</a></div>';return}
 const variants=getVariants(p);
 let chosen=variants.length?0:-1;
 view.innerHTML=`<div class="detail"><div><img id="mainphoto" class="main-photo" src="${escape(photo(p))}" alt="${escape(p.name)}"><div class="thumbs">${(p.images||[]).map((url,i)=>`<button class="${i===0?'active':''}" data-photo="${escape(url)}"><img src="${escape(url)}" alt="Imagem ${i+1}"></button>`).join('')}</div></div><div><span class="eyebrow">${escape(p.category)}</span><h1>${escape(p.name)}</h1><p>${escape(p.description)}</p>${variants.length?`<section class="mid-options" aria-label="Variações do produto"><strong class="mid-options-heading">Escolha o tamanho / opção:</strong><div class="mid-options-list">${variants.map((v,i)=>`<button type="button" class="mid-option ${i===0?'selected':''}" data-variant="${i}" aria-pressed="${i===0?'true':'false'}"><span>${escape(v.label)}</span><small>${money(v.price)}</small></button>`).join('')}</div></section>`:''}<div class="price" id="mid-detail-price">${money(chosen>=0?variants[chosen].price:p.price)}</div><button class="btn primary" id="whatsapp">Consultar no WhatsApp ↗</button><p class="muted" style="font-size:13px">Disponibilidade, personalizações e entrega combinadas diretamente com a loja.</p><p><a href="#/catalogo">← Voltar ao catálogo</a></p></div></div>`;
 document.querySelector('#whatsapp').onclick=()=>whatsapp(p,chosen>=0?variants[chosen]:null);
 document.querySelectorAll('[data-variant]').forEach(btn=>btn.onclick=()=>{
  chosen=Number(btn.dataset.variant);
  document.querySelectorAll('[data-variant]').forEach(b=>{let active=Number(b.dataset.variant)===chosen;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelector('#mid-detail-price').textContent=money(variants[chosen].price);
 });
 document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{document.querySelector('#mainphoto').src=b.dataset.photo;document.querySelectorAll('[data-photo]').forEach(x=>x.classList.toggle('active',x===b))});
}
function bindCards(){view.querySelectorAll('[data-id]').forEach(el=>{el.onclick=()=>location.hash='#/produto/'+encodeURIComponent(el.dataset.id);el.tabIndex=0;el.onkeydown=e=>{if(e.key==='Enter')el.click()}})}function bindCats(){view.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;location.hash='#/catalogo';catalog()})}async function api(route,method='GET',body){if(!cfg.apiUrl)throw Error('Configure apiUrl em config.js e publique o Worker para ativar o painel online.');let r=await fetch(cfg.apiUrl.replace(/\/$/,'')+route,{method,headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});let j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Erro '+r.status);return j}function admin(){if(!token){view.innerHTML=`<div class="panel" style="max-width:430px"><h1>Painel administrativo</h1><p>Entre para gerenciar os produtos do catálogo.</p><form id="login"><label class="field">Senha administrativa<input type="password" id="password" autocomplete="current-password" required></label><button class="btn primary" style="margin-top:17px">Entrar</button></form><p class="note">O login depende do Worker seguro configurado. Nunca coloque sua senha ou token GitHub no JavaScript público.</p></div>`;document.querySelector('#login').onsubmit=async e=>{e.preventDefault();try{let j=await api('/login','POST',{password:document.querySelector('#password').value});token=j.token;sessionStorage.setItem('mid_admin_token',token);admin()}catch(err){toast(err.message)}};return}view.innerHTML=`<div class="panel"><div class="adminbar"><div><h1>Gerenciar MID Store</h1><p>Produtos, fotos, preços e categorias</p></div><button class="btn" id="logout">Sair</button></div><p class="note">As alterações só aparecerão para todos após a publicação no GitHub. O catálogo pode demorar alguns instantes para atualizar.</p><div class="formactions"><button class="btn primary" id="new">＋ Adicionar produto</button><button class="btn" id="settings">Configurações da loja</button><button class="btn" id="refresh">Atualizar dados</button></div><div id="adminbody"></div></div>`;document.querySelector('#logout').onclick=()=>{token='';sessionStorage.removeItem('mid_admin_token');admin()};document.querySelector('#new').onclick=()=>editForm(null);document.querySelector('#settings').onclick=settingsForm;document.querySelector('#refresh').onclick=async()=>{try{await load(true);admin()}catch(e){toast(e.message)}};adminList()};function adminList(){let el=document.querySelector('#adminbody');el.innerHTML=`<div class="sectionhead"><h2>Produtos cadastrados (${db.products.length})</h2></div>${db.products.map(p=>`<div class="adminitem"><img src="${escape(photo(p))}" alt=""><div class="info"><strong>${escape(p.name)}</strong><small>${escape(p.category)} · ${money(p.price)}</small></div><button class="btn" data-edit="${escape(p.id)}">Editar</button><button class="btn" data-delete="${escape(p.id)}">Excluir</button></div>`).join('')}`;el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editForm(product(b.dataset.edit)));el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este produto definitivamente?'))return;try{await api('/products/'+encodeURIComponent(b.dataset.delete),'DELETE');await load(true);admin();toast('Produto excluído')}catch(e){toast(e.message)}})}
// Otimização compatível com diferentes celulares. HEIC/HEIF são aceitos
// somente quando o navegador conseguir decodificar a imagem.
async function optimizeProductPhoto(file){
  const MAX_ORIGINAL=20*1024*1024;
  const TARGET=1200*1024;
  const MAX_ENCODED=3*1024*1024;
  if(!file || !file.size)throw Error('Uma das fotos está vazia ou não pôde ser lida pelo celular.');
  if(file.size>MAX_ORIGINAL)throw Error(`A foto ${file.name} ultrapassa 20 MB.`);
  // No iOS e em alguns gerenciadores de arquivos, o tipo MIME pode vir vazio
  // ou ser HEIC mesmo para uma foto que o navegador consegue converter.
  const accepted=/^image\//i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if(!accepted)throw Error(`O arquivo ${file.name} não parece ser uma imagem.`);

  let objectURL;
  try{
    objectURL=URL.createObjectURL(file);
    const photo=await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(Error(`O navegador não conseguiu abrir ${file.name}. Se for HEIC/HEIF, tente convertê-la para JPG antes de enviar.`));
      img.src=objectURL;
    });
    if(!photo.naturalWidth||!photo.naturalHeight)throw Error(`Imagem inválida: ${file.name}.`);

    const canvas=document.createElement('canvas');
    let supportsWebP=false;
    try{supportsWebP=canvas.toDataURL('image/webp').startsWith('data:image/webp;') || canvas.toDataURL('image/webp').startsWith('data:image/webp,')}
    catch(err){supportsWebP=false}
    const mime=supportsWebP?'image/webp':'image/jpeg';
    const maxDimension=Math.max(photo.naturalWidth,photo.naturalHeight);
    let smallest=null;
    for(const maxSide of [1600,1280,1024,800,640]){
      const scale=Math.min(1,maxSide/maxDimension);
      canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
      const ctx=canvas.getContext('2d');
      if(!ctx)throw Error('Este navegador não conseguiu preparar a foto. Experimente Chrome ou Safari atualizado.');
      if(mime==='image/jpeg'){
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      ctx.imageSmoothingEnabled=true;
      if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
      try{ctx.drawImage(photo,0,0,canvas.width,canvas.height)}
      catch(err){throw Error(`Falha ao processar ${file.name}. Experimente usar uma versão JPG da foto.`)}
      for(const quality of [0.84,0.72,0.60,0.48]){
        let blob=null;
        if(typeof canvas.toBlob==='function'){
          try{blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality))}catch(err){}
        }
        // Alguns navegadores móveis não implementam canvas.toBlob corretamente.
        if(!blob){
          let dataURL;
          try{dataURL=canvas.toDataURL(mime,quality)}catch(err){}
          if(!dataURL || !dataURL.startsWith('data:'+mime+';base64,'))
            throw Error(`Não foi possível compactar ${file.name} neste navegador.`);
          const binary=atob(dataURL.slice(dataURL.indexOf(',')+1));
          const bytes=new Uint8Array(binary.length);
          for(let j=0;j<binary.length;j++)bytes[j]=binary.charCodeAt(j);
          blob=new Blob([bytes],{type:mime});
        }
        if(!smallest||blob.size<smallest.size)smallest=blob;
        if(blob.size<=TARGET){smallest=blob;break}
      }
      if(smallest && smallest.size<=TARGET)break;
    }
    canvas.width=canvas.height=0;
    if(!smallest || smallest.size>MAX_ENCODED)
      throw Error(`Não foi possível reduzir ${file.name}. Experimente usar uma foto de menor resolução.`);
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>typeof reader.result==='string' ? resolve(reader.result) : reject(Error('Erro ao converter imagem.'));
      reader.onerror=()=>reject(Error(`Não foi possível preparar ${file.name} para envio.`));
      reader.readAsDataURL(smallest);
    });
    return {name:file.name.replace(/\.[^.]+$/,'')+(mime==='image/webp'?'.webp':'.jpg'),data};
  }finally{if(objectURL)URL.revokeObjectURL(objectURL)}
}
function editForm(p){
 const editing=!!p;
 const initialVariants=getVariants(p);
 const el=document.querySelector('#adminbody');
 el.innerHTML=`<h2>${editing?'Editar produto':'Novo produto'}</h2><form id="form" class="fields"><label class="field wide">Nome<input name="name" value="${escape(p?.name||'')}" required maxlength="120"></label><label class="field">Preço (R$)<input name="price" type="number" step="0.01" min="0" value="${p?.price??''}" required></label><label class="field">Categoria<select name="category">${db.categories.map(c=>`<option value="${escape(c)}" ${p?.category===c?'selected':''}>${escape(c)}</option>`).join('')}</select></label><section class="field wide mid-variants-panel"><label class="mid-variant-toggle"><input id="mid-has-variants" type="checkbox" ${initialVariants.length?'checked':''}> Este produto possui variações de tamanho e preço</label><div id="mid-variant-settings" ${initialVariants.length?'':'hidden'}><p class="mid-variant-note">Cada tamanho tem seu preço. No catálogo, será exibido “A partir de” com o menor valor.</p><div id="mid-variant-rows"></div><button type="button" class="btn" id="mid-add-variant">＋ Adicionar tamanho / opção</button></div></section><label class="field wide">Descrição<textarea name="description">${escape(p?.description||'')}</textarea></label><label class="field wide">Imagens (até 20 MB cada — compressão automática)<input name="photos" type="file" accept="image/*,.heic,.heif" multiple><small>JPG, PNG, WebP e HEIC/HEIF, se o celular conseguir abrir. Até 8 imagens por envio. Imagens existentes são preservadas ao editar.</small><span id="photo-progress" role="status" aria-live="polite"></span></label><div class="field wide"><div class="formactions"><button class="btn primary">Salvar produto</button><button class="btn" type="button" id="cancel">Cancelar</button></div></div></form>`;
 const form=el.querySelector('#form');
 document.querySelector('#cancel').onclick=adminList;
 const toggle=form.querySelector('#mid-has-variants');
 const variantSettings=form.querySelector('#mid-variant-settings');
 const rows=form.querySelector('#mid-variant-rows');
 const priceInput=form.elements.price;
 let basePrice=priceInput.value;
 function updateBasePrice(){
  if(!toggle.checked)return;
  const vals=[...rows.querySelectorAll('.mid-variant-price')].map(x=>x.value.trim()===''?NaN:Number(x.value)).filter(x=>Number.isFinite(x)&&x>=0);
  priceInput.value=vals.length?Math.min(...vals).toFixed(2):'';
 }
 function addRow(label='',price=''){
  if(rows.children.length>=20){toast('Limite de 20 variações por produto.');return}
  const row=document.createElement('div');row.className='mid-variant-row';
  row.innerHTML=`<label class="field">Tamanho / opção<input class="mid-variant-label" maxlength="60" placeholder="Ex.: 15 cm, P, Médio" value="${escape(label)}" required></label><label class="field">Preço (R$)<input class="mid-variant-price" type="number" min="0" step="0.01" placeholder="0,00" value="${price===''?'':Number(price)}" required></label><button class="mid-variant-remove" type="button" aria-label="Remover variação" title="Remover variação">×</button>`;
  row.querySelector('button').onclick=()=>{row.remove();updateBasePrice()};
  row.querySelector('.mid-variant-price').addEventListener('input',updateBasePrice);
  rows.appendChild(row);updateBasePrice();
 }
 function updateToggle(){
  variantSettings.hidden=!toggle.checked;
  priceInput.readOnly=toggle.checked;
  priceInput.required=!toggle.checked;
  if(toggle.checked){if(!rows.children.length)addRow();updateBasePrice()}
  else priceInput.value=basePrice;
  // Campos invisíveis não podem impedir o salvamento de produto sem variações.
  rows.querySelectorAll('input').forEach(input=>{input.disabled=!toggle.checked});
 }
 initialVariants.forEach(v=>addRow(v.label,v.price));
 toggle.addEventListener('change',()=>{if(toggle.checked)basePrice=priceInput.value;updateToggle()});
 form.querySelector('#mid-add-variant').onclick=()=>addRow();
 updateToggle();
 const photoInput=form.querySelector('[name=photos]');
 const photoStatus=form.querySelector('#photo-progress');
 photoInput.addEventListener('change',()=>{const files=[...photoInput.files];photoStatus.textContent=files.length?`${files.length} imagem(ns) selecionada(s): ${files.map(x=>x.name).join(', ')}`:'Nenhuma imagem selecionada.'});
 form.onsubmit=async e=>{
  e.preventDefault();
  const fd=new FormData(form),files=[...form.elements.photos.files];
  let variants=[];
  if(toggle.checked){
   const items=[...rows.querySelectorAll('.mid-variant-row')];
   if(!items.length){toast('Adicione pelo menos um tamanho / opção.');return}
   const seen=new Set();
   for(const item of items){
    const label=item.querySelector('.mid-variant-label').value.trim();
    const raw=item.querySelector('.mid-variant-price').value.trim();
    const price=Number(raw);
    if(!label||!raw||!Number.isFinite(price)||price<0){toast('Preencha todos os tamanhos e preços.');return}
    if(seen.has(label.toLocaleLowerCase('pt-BR'))){toast('Não repita o mesmo nome de tamanho / opção.');return}
    seen.add(label.toLocaleLowerCase('pt-BR'));
    variants.push({label,price});
   }
  }
  if(files.length>8){toast('Selecione no máximo 8 imagens por envio.');return}
  if(!editing && files.length===0 && !confirm('Nenhuma imagem selecionada. Deseja criar o produto sem imagem?'))return;
  if(files.some(x=>x.size>20*1024*1024)){toast('Cada imagem original deve ter no máximo 20 MB.');return}
  let images=[];
  const button=form.querySelector('button.btn.primary');
  const progress=form.querySelector('#photo-progress');
  try{
   button.disabled=true;
   for(let i=0;i<files.length;i++){progress.textContent=`Otimizando imagem ${i+1} de ${files.length}…`;images.push(await optimizeProductPhoto(files[i]))}
   progress.textContent='Enviando produto para publicação…';
   const record={name:fd.get('name'),price:variants.length?Math.min(...variants.map(v=>v.price)):Number(fd.get('price')),category:fd.get('category'),description:fd.get('description'),images,variants};
   button.textContent='Publicando…';
   await api(editing?'/products/'+encodeURIComponent(p.id):'/products',editing?'PUT':'POST',record);
   await load(true);admin();toast('Produto publicado com sucesso');
  }catch(err){const message=err?.message==='Failed to fetch'?'Falha de conexão ao enviar as imagens. Confira a internet e tente novamente.':(err?.message||'Não foi possível publicar o produto.');progress.textContent=message;toast(message)}
  finally{if(form.isConnected){button.disabled=false;button.textContent='Salvar produto'}}
 };
}
function settingsForm(){document.querySelector('#adminbody').innerHTML=`<h2>Configurações</h2><form id="settingsform" class="fields"><label class="field wide">WhatsApp com DDI + DDD<input name="whatsapp" placeholder="5511999999999" value="${escape(db.settings.whatsapp||'')}" required></label><label class="field wide">Título do banner<input name="bannerTitle" value="${escape(db.settings.bannerTitle||'')}"></label><label class="field wide">Descrição do banner<input name="bannerSubtitle" value="${escape(db.settings.bannerSubtitle||'')}"></label><label class="field wide">Banner na página inicial<select name="bannerEnabled"><option value="true">Ativado</option><option value="false" ${db.settings.bannerEnabled===false?'selected':''}>Desativado</option></select></label><label class="field wide">Categorias (uma por linha)<textarea name="categories">${escape(db.categories.join('\n'))}</textarea></label><div class="formactions"><button class="btn primary">Salvar configurações</button><button type="button" class="btn" id="cancel">Cancelar</button></div></form>`;document.querySelector('#cancel').onclick=adminList;document.querySelector('#settingsform').onsubmit=async e=>{e.preventDefault();let d=new FormData(e.target);try{await api('/settings','PUT',{settings:{whatsapp:d.get('whatsapp'),bannerTitle:d.get('bannerTitle'),bannerSubtitle:d.get('bannerSubtitle'),bannerEnabled:d.get('bannerEnabled')==='true'},categories:String(d.get('categories')).split(/\n/).map(x=>x.trim()).filter(Boolean)});await load(true);admin();toast('Configurações publicadas')}catch(err){toast(err.message)}}};async function load(force){let url='products.json'+(force?'?v='+Date.now():'');let r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Erro ao carregar produtos');db=await r.json()};function render(){let route=decodeURIComponent(path());if(route==='admin')admin();else if(route.startsWith('produto/'))detail(route.slice(8));else if(route==='catalogo')catalog();else home()}window.addEventListener('hashchange',render);load().then(render).catch(err=>{view.innerHTML=`<div class="empty">Não foi possível carregar o catálogo. ${escape(err.message)}</div>`});if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));})();
