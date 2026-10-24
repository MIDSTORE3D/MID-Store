/* MID Store — compartilhar link de produto (Web Share API + copiar link).
   Funciona com as rotas #/produto/ID, sem exigir mudanças no backend. */
(()=>{'use strict';
  const view=document.getElementById('view');
  if(!view)return;

  function notification(message){
    const el=document.getElementById('toast');
    if(!el)return;
    el.textContent=message;
    el.style.display='block';
    clearTimeout(el._t);
    el._t=setTimeout(()=>{el.style.display='none';},3200);
  }

  async function copyLink(url){
    if(navigator.clipboard && typeof navigator.clipboard.writeText==='function'){
      try{await navigator.clipboard.writeText(url);return true;}catch(_){}
    }
    // Fallback para navegadores móveis sem Clipboard API.
    const input=document.createElement('textarea');
    input.value=url;
    input.setAttribute('readonly','');
    input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(input);
    input.focus();input.select();
    let ok=false;
    try{ok=document.execCommand('copy');}catch(_){}
    input.remove();
    return ok;
  }

  async function shareProduct(){
    const match=/^#\/produto\/(.+)$/.exec(location.hash);
    if(!match)return;
    let id;
    try{id=decodeURIComponent(match[1]);}catch(_){id=match[1];}
    const url=location.origin+location.pathname+'#/produto/'+encodeURIComponent(id);
    const name=view.querySelector('.detail h1')?.textContent?.trim()||'Produto';
    if(typeof navigator.share==='function'){
      try{
        await navigator.share({title:name+' | MID Store',text:'Confira este produto na MID Store!',url});
        return;
      }catch(error){
        // O usuário fechou o menu sem compartilhar; não é um erro.
        if(error?.name==='AbortError')return;
      }
    }
    const copied=await copyLink(url);
    if(copied)notification('Link do produto copiado!');
    else window.prompt('Copie o link do produto:',url);
  }

  function mountButton(){
    const detail=view.querySelector('.detail');
    if(!detail)return;
    const whatsapp=detail.querySelector('#whatsapp');
    if(!whatsapp||detail.querySelector('.mid-product-share'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='btn mid-product-share';
    button.setAttribute('aria-label','Compartilhar link deste produto');
    button.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/></svg><span>Compartilhar produto</span>';
    button.addEventListener('click',shareProduct);
    whatsapp.insertAdjacentElement('afterend',button);
  }
  mountButton();
  new MutationObserver(mountButton).observe(view,{childList:true,subtree:true});
})();
