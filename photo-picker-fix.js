/* MID Store — gerenciador de imagens.
   Seleção em lote, enquadramento opcional por imagem, remoção confirmada.
   Usa a API existente; para editar imagens publicadas requer Worker atualizado. */
(()=>{'use strict';
  const LIMIT=8, MAX_SOURCE=20*1024*1024, OPT_TARGET=1200*1024;
  let active=null;
  const css=`
  .mid-im-panel{grid-column:1/-1;border:1px solid #594052;background:#1b1721;border-radius:16px;padding:16px;margin:6px 0;min-width:0}
  .mid-im-title{font-size:16px;font-weight:800;color:#ffe4f1;margin:0 0 8px}
  .mid-im-hint,.mid-im-status{font-size:13px;color:#d8b9ca;line-height:1.5;margin:8px 0}
  .mid-im-select{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
  .mid-im-select label{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:11px 15px;border:1px solid #8b5672;background:#362238;color:#fff;border-radius:10px;font-size:13px;font-weight:700}
  .mid-im-select input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .mid-im-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:14px;margin-top:14px}
  .mid-im-card{position:relative;border:1px solid #604354;background:#111019;border-radius:14px;overflow:hidden;min-width:0}
  .mid-im-imgbtn{display:block;position:relative;width:100%;aspect-ratio:1;border:0;background:#25212a;padding:0;cursor:zoom-in}
  .mid-im-imgbtn img{width:100%;height:100%;display:block;object-fit:contain}
  .mid-im-placeholder{display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;color:#eac6d7;height:100%}
  .mid-im-actions{position:absolute;right:8px;top:8px;display:flex;gap:7px;z-index:1}
  .mid-im-actions button{display:grid;place-items:center;width:39px;height:39px;border:1px solid #c39bb0;background:#2b1a2eec;color:#fff;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px #0009}
  .mid-im-actions button:hover{background:#73405b}
  .mid-im-actions .mid-im-x{font-size:25px;line-height:1;background:#6c2b43ef}
  .mid-im-actions svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .mid-im-cover{position:absolute;top:8px;left:8px;padding:5px 8px;border-radius:7px;color:#2b1222;background:#f1a0c6;font-size:11px;font-weight:800;pointer-events:none}
  .mid-im-caption{font-size:12px;color:#d8b7c8;padding:10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mid-im-dialog{position:fixed;inset:0;z-index:30000;background:#09070bdc;display:flex;align-items:center;justify-content:center;padding:15px;overscroll-behavior:contain}
  .mid-im-modal{width:min(100%,520px);max-height:calc(100dvh - 30px);overflow:auto;background:#1d1723;border:1px solid #80536e;border-radius:18px;padding:18px;color:#fff;box-shadow:0 18px 60px #000b}
  .mid-im-modal h2{font-size:20px;margin:0 0 12px;line-height:1.3}
  .mid-im-modal p{font-size:14px;color:#d7b8c9;line-height:1.5;margin:0 0 16px}
  .mid-im-modal-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
  .mid-im-modal-actions button,.mid-im-zoom-row button{border:1px solid #7d5570;border-radius:10px;background:#352639;color:white;padding:11px 16px;font-size:14px;font-weight:750;cursor:pointer}
  .mid-im-modal-actions .mid-im-primary{background:#e875a8;border-color:#e875a8;color:#291420}
  .mid-im-modal-actions .mid-im-danger{background:#9b345c;border-color:#aa4670}
  .mid-im-crop{display:block;width:min(100%,420px);aspect-ratio:1;margin:auto;background:#0c0b11;touch-action:none;overflow:hidden;border:2px solid #f09cc5;border-radius:8px;position:relative;cursor:grab;user-select:none}
  .mid-im-crop:active{cursor:grabbing}
  .mid-im-crop img{position:absolute;max-width:none;max-height:none;pointer-events:none;user-select:none;-webkit-user-drag:none}
  .mid-im-crop:after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 2px #ffffff49;pointer-events:none}
  .mid-im-zoom-row{display:flex;align-items:center;gap:10px;margin:14px 0 6px}
  .mid-im-zoom-row input{flex:1;min-width:0;accent-color:#e875a8}
  .mid-im-zoom-row output{min-width:47px;text-align:right;color:#f8c2dd;font-size:13px}
  .mid-im-preview-large{display:block;width:100%;max-height:75dvh;object-fit:contain}
  @media(max-width:620px){.mid-im-grid{grid-template-columns:1fr}.mid-im-panel{padding:11px}.mid-im-card{max-width:100%}.mid-im-modal{padding:13px}}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);

  function iconCrop(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,cls,action){const b=el('button',cls,text);b.type='button';if(action)b.onclick=action;return b;}
  const filesize=n=>n<1024*1024?`${Math.round(n/1024)} KB`:`${(n/1024/1024).toFixed(1)} MB`;
  const urlFor=path=>new URL(path,location.href.split('#')[0]).href;
  async function loadProducts(){const res=await fetch('./products.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Não foi possível carregar as imagens existentes.');return res.json();}
  async function toImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Não foi possível abrir esta imagem. Tente selecionar uma versão JPG ou PNG.'));img.src=src;});}
  async function toBlob(canvas,mime,quality){if(canvas.toBlob){const b=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality));if(b)return b;}
    const data=canvas.toDataURL(mime,quality);const raw=atob(data.slice(data.indexOf(',')+1));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:mime});}
  async function compressFile(file){
    if(!file.size||file.size>MAX_SOURCE)throw Error(`A imagem ${file.name} está vazia ou ultrapassa 20 MB.`);
    const src=URL.createObjectURL(file);
    try{const img=await toImage(src);const canvas=document.createElement('canvas');
      let best=null;const supports=canvas.toDataURL('image/webp').startsWith('data:image/webp');const mime=supports?'image/webp':'image/jpeg';
      for(const side of [1600,1280,1024,800]){const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight));
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Este navegador não consegue processar imagens.');
        if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        for(const q of [.84,.72,.6,.48]){const b=await toBlob(canvas,mime,q);if(!best||b.size<best.size)best=b;if(b.size<=OPT_TARGET){best=b;break;}}
        if(best.size<=OPT_TARGET)break;
      }
      if(!best||best.size>3*1024*1024)throw Error(`A imagem ${file.name} ficou grande demais após a compressão.`);
      return new File([best],(file.name.replace(/\.[^.]+$/,'')||'imagem')+(mime==='image/webp'?'.webp':'.jpg'),{type:mime});
    }finally{URL.revokeObjectURL(src);}
  }
  async function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Não foi possível preparar a imagem para envio.'));r.readAsDataURL(file);});}

  function enhance(){
    const form=document.querySelector('#form');
    if(active&&active.form!==form){active.dispose();active=null;}
    if(!form||active)return;
    const original=form.querySelector('input[type=file][name=photos]');if(!original)return;
    const editing=form.querySelector('h2')?.textContent?.includes('Editar')||document.querySelector('#adminbody>h2')?.textContent?.includes('Editar');
    // O app original continua responsável por login e demais campos.
    const photosLabel=original.closest('label');if(photosLabel)photosLabel.style.display='none';
    original.disabled=true;
    const panel=el('section','mid-im-panel');
    const title=el('div','mid-im-title','Imagens do produto');
    const hint=el('div','mid-im-hint','Selecione várias imagens de uma vez. Depois use ⛶ para ajustar qualquer imagem, ou × para removê-la. O ajuste é opcional.');
    const actions=el('div','mid-im-select');
    const addLabel=el('label','','＋ Selecionar imagens');const addInput=el('input');addInput.type='file';addInput.multiple=true;addInput.accept='image/*,.heic,.heif';addLabel.append(addInput);
    const altLabel=el('label','','＋ Selecionar por Arquivos');const altInput=el('input');altInput.type='file';altInput.accept='';altLabel.append(altInput);
    actions.append(addLabel,altLabel);
    const status=el('div','mid-im-status','Carregando imagens…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const grid=el('div','mid-im-grid');panel.append(title,hint,actions,status,grid);
    if(photosLabel)photosLabel.after(panel);else form.append(panel);
    const progress=form.querySelector('#photo-progress');
    const list=[]; // {kind:'old',path,url} | {kind:'new',file,url}
    let disposed=false,ready=false,busy=false,dialog=null,prevFocus=null,productId=null;
    function close(){if(dialog){dialog.remove();dialog=null;}if(prevFocus?.isConnected)prevFocus.focus();prevFocus=null;}
    function modal(titleText){close();prevFocus=document.activeElement;dialog=el('div','mid-im-dialog');dialog.setAttribute('role','presentation');
      const content=el('div','mid-im-modal');content.setAttribute('role','dialog');content.setAttribute('aria-modal','true');content.setAttribute('aria-label',titleText);
      const heading=el('h2','',titleText);content.append(heading);dialog.append(content);document.body.append(dialog);
      dialog.addEventListener('click',e=>{if(e.target===dialog)close();});return content;}
    function escapeClose(e){if(e.key==='Escape'&&dialog)close();}document.addEventListener('keydown',escapeClose);
    function revoke(item){if(item.kind==='new'&&item.url)URL.revokeObjectURL(item.url);}
    function render(message){grid.replaceChildren();status.textContent=message||(list.length?`${list.length} imagem(ns) pronta(s). A primeira será a capa do produto.`:'Nenhuma imagem selecionada.');
      for(let i=0;i<list.length;i++){
        const item=list[i],card=el('div','mid-im-card');const open=button('','mid-im-imgbtn',()=>showLarge(item));
        const img=el('img');img.src=item.url;img.alt='Prévia da imagem '+(i+1);
        img.onerror=()=>{img.replaceWith(el('div','mid-im-placeholder','Prévia indisponível neste dispositivo'));};open.append(img);card.append(open);
        if(i===0)card.append(el('span','mid-im-cover','Capa'));
        const controls=el('div','mid-im-actions');
        const crop=button('','',()=>cropItem(item));crop.setAttribute('aria-label','Ajustar enquadramento da imagem '+(i+1));crop.title='Ajustar enquadramento';crop.innerHTML=iconCrop();
        const remove=button('×','mid-im-x',()=>confirmRemove(item));remove.setAttribute('aria-label','Remover imagem '+(i+1));remove.title='Remover imagem';
        controls.append(crop,remove);card.append(controls);
        const name=item.kind==='old'?'Imagem publicada':item.file.name;
        card.append(el('div','mid-im-caption',name));grid.append(card);
      }
    }
    function confirmRemove(item){const m=modal('Remover imagem?');m.append(el('p','','Tem certeza que deseja remover esta imagem do produto? Ela só será removida do catálogo quando você salvar as alterações.'));
      const a=el('div','mid-im-modal-actions');a.append(button('Cancelar','',close),button('Remover imagem','mid-im-danger',()=>{
        const index=list.indexOf(item);if(index>=0){list.splice(index,1);revoke(item);render();}close();
      }));m.append(a);a.querySelector('button')?.focus();}
    function showLarge(item){const m=modal('Visualização da imagem');const img=el('img','mid-im-preview-large');img.src=item.url;img.alt='Imagem selecionada';m.append(img);
      const a=el('div','mid-im-modal-actions');a.append(button('Fechar','mid-im-primary',close));m.append(a);}
    async function cropItem(item){
      if(busy)return;
      let image;try{image=await toImage(item.url);}catch(error){render(error.message);return;}
      const m=modal('Ajustar enquadramento');m.append(el('p','','Arraste a imagem para posicionar e use o controle para aproximar ou afastar. O recorte será quadrado.'));
      const square=el('div','mid-im-crop');const visual=el('img');visual.src=item.url;visual.alt='Imagem para enquadrar';square.append(visual);m.append(square);
      const zr=el('div','mid-im-zoom-row');const range=el('input');range.type='range';range.min='1';range.max='3';range.step='0.01';range.value='1';range.setAttribute('aria-label','Zoom da imagem');const zoomText=el('output','','100%');
      zr.append(el('span','','Zoom'),range,zoomText);m.append(zr);
      const a=el('div','mid-im-modal-actions');const cancel=button('Cancelar','',close);const apply=button('Aplicar enquadramento','mid-im-primary',async()=>{
        apply.disabled=true;apply.textContent='Preparando imagem…';
        try{const cvs=document.createElement('canvas');cvs.width=1200;cvs.height=1200;const c=cvs.getContext('2d');if(!c)throw Error('Este dispositivo não suporta recorte de imagem.');
          const k=1200/square.clientWidth;const dims=getDims();
          const webp=cvs.toDataURL('image/webp').startsWith('data:image/webp');const mime=webp?'image/webp':'image/jpeg';
          if(!webp){c.fillStyle='#fff';c.fillRect(0,0,1200,1200);}
          c.drawImage(image,dims.left*k,dims.top*k,dims.width*k,dims.height*k);
          let blob=await toBlob(cvs,mime,.86);if(blob.size>3*1024*1024)blob=await toBlob(cvs,mime,.7);
          const file=new File([blob],'imagem-ajustada-'+Date.now()+(mime==='image/webp'?'.webp':'.jpg'),{type:mime});
          const index=list.indexOf(item);if(index<0){close();return;}
          revoke(item);list[index]={kind:'new',file,url:URL.createObjectURL(file)};close();render('Enquadramento aplicado! Salve o produto para publicar a alteração.');
        }catch(error){apply.disabled=false;apply.textContent='Aplicar enquadramento';status.textContent=error.message;}
      });a.append(cancel,apply);m.append(a);
      let dx=0,dy=0,zoom=1,last=null;
      function getDims(){const s=square.clientWidth||320;const base=Math.max(s/image.naturalWidth,s/image.naturalHeight)*zoom;const width=image.naturalWidth*base,height=image.naturalHeight*base;
        const maxX=Math.max(0,(width-s)/2),maxY=Math.max(0,(height-s)/2);dx=Math.max(-maxX,Math.min(maxX,dx));dy=Math.max(-maxY,Math.min(maxY,dy));
        return {width,height,left:(s-width)/2+dx,top:(s-height)/2+dy};}
      function paint(){const d=getDims();visual.style.cssText=`left:${d.left}px;top:${d.top}px;width:${d.width}px;height:${d.height}px`;zoomText.textContent=Math.round(zoom*100)+'%';}
      range.oninput=()=>{zoom=Number(range.value);paint();};
      square.addEventListener('pointerdown',e=>{last={x:e.clientX,y:e.clientY};square.setPointerCapture(e.pointerId);e.preventDefault();});
      square.addEventListener('pointermove',e=>{if(!last)return;dx+=e.clientX-last.x;dy+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};paint();});
      const end=()=>last=null;square.addEventListener('pointerup',end);square.addEventListener('pointercancel',end);
      requestAnimationFrame(paint);cancel.focus();
    }
    function addFiles(input){if(!ready){status.textContent='Aguarde carregar as imagens do produto.';return;}
      const files=[...(input.files||[])];input.value='';if(!files.length)return;
      const errors=[];for(const file of files){if(list.length>=LIMIT){errors.push('Limite de 8 imagens por produto.');break;}
        if(!file.size||file.size>MAX_SOURCE){errors.push(file.name+': tamanho inválido ou superior a 20 MB.');continue;}
        if(!(file.type.startsWith('image/')||/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name))){errors.push(file.name+': formato de imagem não reconhecido.');continue;}
        if(list.some(x=>x.kind==='new'&&x.file.name===file.name&&x.file.size===file.size&&x.file.lastModified===file.lastModified)){errors.push(file.name+': imagem já selecionada.');continue;}
        list.push({kind:'new',file,url:URL.createObjectURL(file)});
      }render(errors.length?errors.join(' '):null);
    }
    addInput.onchange=()=>addFiles(addInput);altInput.onchange=()=>addFiles(altInput);
    // Captura o envio para lidar com imagens mantidas, removidas e substituídas.
    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();if(busy||!ready)return;busy=true;
      const submit=form.querySelector('button:not([type]),button[type="submit"]');const originalText=submit?.textContent;
      if(submit){submit.disabled=true;submit.textContent='Preparando imagens…';}
      try{const fd=new FormData(form);if(editing&&!productId)throw Error('Produto não identificado. Abra a edição novamente.');
        const data={name:fd.get('name'),price:Number(fd.get('price')),category:fd.get('category'),description:fd.get('description'),images:[],imageOrder:[]};
        if(!list.length&&!editing && !confirm('Nenhuma imagem selecionada. Deseja publicar o produto sem imagem?'))return;
        for(let i=0;i<list.length;i++){
          const item=list[i];if(item.kind==='old'){data.imageOrder.push({kind:'old',path:item.path});continue;}
          status.textContent=`Otimizando imagem ${i+1} de ${list.length}…`;
          const compressed=await compressFile(item.file);const imageIndex=data.images.length;
          data.images.push({name:compressed.name,data:await fileData(compressed)});
          data.imageOrder.push({kind:'new',index:imageIndex});
        }
        status.textContent='Publicando alterações no GitHub…';if(submit)submit.textContent='Publicando…';
        const token=sessionStorage.getItem('mid_admin_token')||'';const url=window.MID_CONFIG?.apiUrl;
        if(!url)throw Error('Endereço da API não configurado.');
        const endpoint=url.replace(/\/$/,'')+(editing?'/products/'+encodeURIComponent(productId):'/products');
        const response=await fetch(endpoint,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(data)});
        const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||('Falha no servidor: '+response.status));
        status.textContent='Produto salvo com sucesso! Atualizando painel…';
        location.reload();
      }catch(error){status.textContent='Erro: '+(error?.message||'Não foi possível publicar o produto.');}
      finally{busy=false;if(submit?.isConnected){submit.disabled=false;submit.textContent=originalText;}}
    },true);
    async function init(){
      if(editing){
        try{const data=await loadProducts();const name=form.elements.name?.value||'';
          const matches=data.products.filter(p=>p.name===name && p.category===form.elements.category?.value && Number(p.price)===Number(form.elements.price?.value));
          const exact=matches.filter(p=>String(p.description||'')===String(form.elements.description?.value||''));
          const matches2=exact.length===1?exact:(matches.length===1?matches:data.products.filter(p=>p.name===name));
          if(matches2.length!==1)throw Error('Não foi possível identificar este produto de forma única.');
          const item=matches2[0];productId=item.id;
          for(const path of item.images||[])list.push({kind:'old',path,url:urlFor(path)});
        }catch(error){status.textContent='Erro: '+error.message;return;}
      }
      if(disposed)return;ready=true;render();
    }
    active={form,dispose(){disposed=true;close();document.removeEventListener('keydown',escapeClose);for(const item of list)revoke(item);}};
    init();
  }
  enhance();new MutationObserver(enhance).observe(document.body,{subtree:true,childList:true});
})();
