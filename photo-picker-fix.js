/* MID Store — seleção e pré-visualização de fotos antes da publicação.
   Compatível com o cadastro existente: mantém os File(s) no input[name=photos].
   Não publica nem altera arquivos até o usuário salvar o formulário. */
(()=>{'use strict';
  const MAX_PHOTOS=8;
  const MAX_FILE_SIZE=20*1024*1024;
  let active=null;

  const css=`
  .mid-photos-panel{border:1px solid #554352;background:#1b1721;border-radius:15px;padding:14px;margin:10px 0;min-width:0}
  .mid-photos-hint{font-size:13px;color:#dcb8ca;line-height:1.5}
  .mid-photos-status{font-size:13px;color:#f5bfd7;line-height:1.5;margin:10px 0}
  .mid-photos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:12px;margin-top:12px}
  .mid-photo-card{background:#101019;border:1px solid #594054;border-radius:13px;padding:7px;min-width:0;position:relative}
  .mid-photo-open{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1 / 1;background:#292331;color:#e9c4d6;border:0;border-radius:9px;overflow:hidden;cursor:zoom-in;padding:0}
  .mid-photo-open img{width:100%;height:100%;object-fit:contain;display:block}
  .mid-photo-info{font-size:11px;color:#bcb1bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:8px 2px}
  .mid-photo-tools{display:flex;gap:5px;justify-content:flex-end}
  .mid-photo-tools button{border:1px solid #795169;border-radius:7px;padding:6px 9px;background:#362334;color:#fff;cursor:pointer;font-size:13px;min-width:30px}
  .mid-photo-tools button:disabled{opacity:.35;cursor:default}
  .mid-photo-remove{background:#5f243d!important}
  .mid-photo-mark{position:absolute;top:12px;left:12px;background:#e875a8;color:#210e1b;font-weight:800;font-size:10px;padding:5px 8px;border-radius:6px;pointer-events:none}
  .mid-photo-lightbox{position:fixed;inset:0;background:rgba(7,6,12,.94);z-index:20000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;color:#fff}
  .mid-photo-lightbox img{max-width:calc(100vw - 40px);max-height:calc(100dvh - 135px);object-fit:contain;border-radius:9px}
  .mid-photo-lightbox .mid-lightbox-close{position:absolute;top:16px;right:16px;padding:10px 16px;border:1px solid #c386a3;border-radius:9px;background:#382239;color:#fff;cursor:pointer}
  .mid-photo-lightbox p{margin:0;max-width:90%;word-break:break-word;text-align:center;font-size:13px;color:#efcee0}
  @media(max-width:500px){.mid-photos-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.mid-photos-panel{padding:10px}}
  `;
  const style=document.createElement('style');
  style.textContent=css;
  document.head.appendChild(style);

  function enhance(){
    const form=document.querySelector('#form');
    if(active && active.form!==form){active.dispose();active=null;}
    if(!form||active)return;
    const primary=form.querySelector('input[type="file"][name="photos"]');
    if(!primary)return;
    primary.multiple=false; // evite o seletor múltiplo incompatível de alguns celulares
    primary.accept='image/*';

    const oldLabel=primary.closest('label');
    if(oldLabel){
      const heading=oldLabel.firstChild;
      if(heading && heading.nodeType===3)heading.textContent='Fotos do produto (adicione uma por vez)';
      const note=oldLabel.querySelector('small');
      if(note)note.textContent='Selecione até 8 fotos. Elas aparecem abaixo antes da publicação.';
    }

    const panel=document.createElement('section');
    panel.className='mid-photos-panel field wide';
    const hint=document.createElement('div');
    hint.className='mid-photos-hint';
    hint.textContent='Prévia das novas fotos — toque na imagem para ampliar, use as setas para alterar a ordem ou Remover para descartá-la antes de salvar.';
    const alternateLabel=document.createElement('label');
    alternateLabel.className='mid-photos-hint';
    alternateLabel.textContent='Se a galeria falhar, tente selecionar pelos Arquivos:';
    const fallback=document.createElement('input');
    fallback.type='file';
    fallback.id='mid-photo-fallback';
    fallback.setAttribute('aria-label','Selecionar foto pelo gerenciador de arquivos');
    // Não restringir formatos aqui permite usar "Arquivos" em mais aparelhos.
    fallback.style.cssText='display:block;width:100%;margin:8px 0;max-width:100%;color:#fff';
    const status=document.createElement('div');
    status.className='mid-photos-status';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    const grid=document.createElement('div');
    grid.className='mid-photos-grid';
    panel.append(hint,alternateLabel,fallback,status,grid);
    if(oldLabel)oldLabel.after(panel);
    else primary.after(panel);

    const selected=[]; // { file, url } — URL local, nunca enviada ao servidor
    const progress=form.querySelector('#photo-progress');
    let disposed=false;
    let lightbox=null;
    let prevFocus=null;

    function closeLightbox(){
      if(lightbox){lightbox.remove();lightbox=null;}
      if(prevFocus && prevFocus.isConnected)prevFocus.focus();
      prevFocus=null;
    }
    function keydown(event){if(event.key==='Escape')closeLightbox();}
    document.addEventListener('keydown',keydown);

    function syncFiles(){
      try{
        const transfer=new DataTransfer();
        for(const item of selected)transfer.items.add(item.file);
        primary.files=transfer.files;
        return primary.files.length===selected.length;
      }catch(_){return false;}
    }

    function openPreview(item,index){
      if(!item.url)return;
      closeLightbox();
      prevFocus=document.activeElement;
      lightbox=document.createElement('div');
      lightbox.className='mid-photo-lightbox';
      lightbox.setAttribute('role','dialog');
      lightbox.setAttribute('aria-modal','true');
      lightbox.setAttribute('aria-label','Visualização da foto '+(index+1));
      const img=document.createElement('img');
      img.src=item.url;
      img.alt=item.file.name;
      const cap=document.createElement('p');
      cap.textContent=`Foto ${index+1} de ${selected.length} • ${item.file.name}`;
      const close=document.createElement('button');
      close.className='mid-lightbox-close';
      close.type='button';
      close.textContent='Fechar ✕';
      close.addEventListener('click',closeLightbox);
      lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox();});
      lightbox.append(close,img,cap);
      document.body.appendChild(lightbox);
      close.focus();
    }

    function move(index,step){
      const other=index+step;
      if(other<0||other>=selected.length)return;
      [selected[index],selected[other]]=[selected[other],selected[index]];
      syncFiles();
      render();
    }

    function render(message){
      grid.replaceChildren();
      status.textContent=message || (selected.length
        ? `${selected.length} foto(s) selecionada(s). Confira antes de clicar em Salvar produto.`
        : 'Nenhuma foto selecionada.');
      for(let index=0;index<selected.length;index++){
        const item=selected[index];
        const card=document.createElement('div');card.className='mid-photo-card';
        const photo=document.createElement('button');
        photo.className='mid-photo-open';photo.type='button';
        photo.title='Ampliar '+item.file.name;
        photo.setAttribute('aria-label','Ampliar foto '+(index+1));
        const image=document.createElement('img');
        image.src=item.url;image.alt=`Prévia da foto ${index+1}`;
        const fallbackText=document.createElement('span');
        fallbackText.textContent='Sem prévia neste navegador';
        image.addEventListener('error',()=>{image.replaceWith(fallbackText);});
        photo.append(image);photo.addEventListener('click',()=>openPreview(item,index));
        card.append(photo);
        if(index===0){const mark=document.createElement('span');mark.className='mid-photo-mark';mark.textContent='1ª foto';card.append(mark);}
        const info=document.createElement('div');info.className='mid-photo-info';
        info.textContent=`${item.file.name} • ${(item.file.size/(1024*1024)).toFixed(1)} MB`;
        info.title=item.file.name;
        card.append(info);
        const tools=document.createElement('div');tools.className='mid-photo-tools';
        const before=document.createElement('button');before.type='button';before.textContent='←';before.title='Mover foto para antes';before.disabled=index===0;
        before.addEventListener('click',()=>move(index,-1));
        const after=document.createElement('button');after.type='button';after.textContent='→';after.title='Mover foto para depois';after.disabled=index===selected.length-1;
        after.addEventListener('click',()=>move(index,1));
        const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.className='mid-photo-remove';
        remove.setAttribute('aria-label','Remover '+item.file.name);
        remove.addEventListener('click',()=>{
          closeLightbox();
          URL.revokeObjectURL(item.url);
          selected.splice(index,1);
          syncFiles();render();
        });
        tools.append(before,after,remove);
        card.append(tools);grid.append(card);
      }
    }

    function addFiles(input){
      const incoming=Array.from(input.files||[]);
      if(!incoming.length){
        if(!selected.length)render('O celular não entregou a imagem. Tente a opção Arquivos ou abra a loja no navegador.');
        return;
      }
      let reason='';
      for(const file of incoming){
        if(selected.length>=MAX_PHOTOS){reason='Limite de 8 fotos atingido.';break;}
        if(!file.size||file.size>MAX_FILE_SIZE){reason=`${file.name}: imagem vazia ou maior que 20 MB.`;continue;}
        if(!(file.type.startsWith('image/')||/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))){reason=`${file.name}: selecione uma imagem.`;continue;}
        if(selected.some(item=>item.file.name===file.name && item.file.size===file.size && item.file.lastModified===file.lastModified)){
          reason='Esta foto já foi adicionada.';continue;
        }
        selected.push({file,url:URL.createObjectURL(file)});
      }
      if(!syncFiles()){
        for(const item of selected)URL.revokeObjectURL(item.url);
        selected.length=0;
        render('Este navegador não conseguiu anexar as fotos. Experimente Chrome ou Safari atualizado.');
        return;
      }
      render(reason||undefined);
      if(progress)progress.textContent=`${selected.length} foto(s) selecionada(s).`;
    }
    primary.addEventListener('change',()=>addFiles(primary));
    fallback.addEventListener('change',()=>{addFiles(fallback);fallback.value='';});
    primary.addEventListener('click',()=>{primary.value='';});
    primary.addEventListener('cancel',()=>{syncFiles();if(!selected.length)render('Nenhuma foto escolhida. Tente a opção Arquivos.');});
    form.addEventListener('submit',event=>{
      if(selected.length && !syncFiles()){
        event.preventDefault();event.stopImmediatePropagation();
        render('Não foi possível anexar as fotos. Atualize o navegador e tente novamente.');
      }
    },true);
    form.addEventListener('reset',()=>{
      closeLightbox();
      for(const item of selected)URL.revokeObjectURL(item.url);
      selected.length=0;syncFiles();render();
    });

    active={form,dispose(){
      if(disposed)return;disposed=true;closeLightbox();document.removeEventListener('keydown',keydown);
      for(const item of selected)URL.revokeObjectURL(item.url);
      selected.length=0;
    }};
    render();
  }

  enhance();
  const observer=new MutationObserver(enhance);
  observer.observe(document.body,{subtree:true,childList:true});
})();
