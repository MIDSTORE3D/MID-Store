/* MID Store — seletor de fotos compatível com mais celulares.
   Mantém até 8 imagens sem depender do atributo multiple do seletor nativo.
   Não altera os produtos nem o servidor. */
(()=>{'use strict';
  const LIMIT=8;
  const MAX_SIZE=20*1024*1024;
  const initialized=new WeakSet();

  function enhance(){
    const form=document.querySelector('#form');
    if(!form||initialized.has(form))return;
    const primary=form.querySelector('input[type="file"][name="photos"]');
    if(!primary)return;
    initialized.add(form);

    // Alguns seletores de fotos do Android/PWA não devolvem arquivos
    // para um input que usa multiple. Selecionar uma por vez contorna isso.
    primary.removeAttribute('multiple');
    primary.setAttribute('accept','image/*');
    const originalLabel=primary.closest('label');
    if(originalLabel){
      const heading=originalLabel.firstChild;
      if(heading&&heading.nodeType===Node.TEXT_NODE){
        heading.textContent='Fotos do produto (selecione uma de cada vez)';
      }
      const note=originalLabel.querySelector('small');
      if(note)note.textContent='Até 8 fotos por produto. Escolha uma foto, depois abra novamente para adicionar outra. Compressão automática antes do envio.';
    }

    const block=document.createElement('div');
    block.className='field wide';
    block.style.cssText='border:1px solid #554352;border-radius:12px;padding:12px;gap:10px';
    const fallbackLabel=document.createElement('label');
    fallbackLabel.htmlFor='mid-photo-fallback';
    fallbackLabel.textContent='A galeria não devolveu a foto? Tente selecionar pelos Arquivos:';
    fallbackLabel.style.cssText='font-size:13px;color:#e1bcd0';
    const fallback=document.createElement('input');
    fallback.type='file';
    fallback.id='mid-photo-fallback';
    // Sem accept: oferece o gerenciador de arquivos em mais aparelhos.
    fallback.style.cssText='width:100%;color:#fff';
    const feedback=document.createElement('div');
    feedback.id='mid-selected-photos';
    feedback.setAttribute('aria-live','polite');
    feedback.style.cssText='color:#f5bfd7;font-size:13px;line-height:1.6';
    feedback.textContent='Nenhuma foto selecionada.';
    const list=document.createElement('div');
    list.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
    block.append(fallbackLabel,fallback,feedback,list);
    if(originalLabel)originalLabel.after(block);
    else primary.after(block);

    const message=form.querySelector('#photo-progress');
    const chosen=[];
    let urls=[];

    function syncFiles(){
      try{
        const dataTransfer=new DataTransfer();
        for(const file of chosen)dataTransfer.items.add(file);
        primary.files=dataTransfer.files;
        return primary.files.length===chosen.length;
      }catch(_){return false}
    }

    function render(){
      for(const url of urls)URL.revokeObjectURL(url);
      urls=[];
      list.replaceChildren();
      feedback.textContent=chosen.length
        ? `${chosen.length} foto(s) pronta(s) para enviar. Você pode adicionar mais até ${LIMIT}.`
        : 'Nenhuma foto selecionada.';
      for(let i=0;i<chosen.length;i++){
        const file=chosen[i];
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:7px;border:1px solid #554352;padding:6px;border-radius:8px;max-width:100%';
        if(file.type.startsWith('image/')){
          const thumb=document.createElement('img');
          const url=URL.createObjectURL(file);
          urls.push(url);
          thumb.src=url;
          thumb.alt='';
          thumb.style.cssText='width:40px;height:40px;object-fit:cover;border-radius:6px';
          row.append(thumb);
        }
        const name=document.createElement('span');
        name.textContent=file.name;
        name.style.cssText='max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px';
        row.append(name);
        const remove=document.createElement('button');
        remove.type='button';
        remove.textContent='×';
        remove.setAttribute('aria-label','Remover '+file.name);
        remove.style.cssText='cursor:pointer;background:#37212f;color:white;border:1px solid #986c86;border-radius:6px;padding:4px 9px';
        remove.addEventListener('click',()=>{
          chosen.splice(i,1);
          syncFiles();
          render();
        });
        row.append(remove);
        list.append(row);
      }
    }

    function addFiles(input){
      const incoming=Array.from(input.files||[]);
      if(!incoming.length){
        if(!chosen.length)feedback.textContent='O celular não devolveu a imagem. Tente a opção Arquivos logo acima ou abra o catálogo no navegador.';
        return;
      }
      for(const file of incoming){
        if(chosen.length>=LIMIT){
          feedback.textContent=`Limite de ${LIMIT} fotos atingido. Remova uma antes de adicionar outra.`;
          break;
        }
        if(file.size>MAX_SIZE){
          if(message)message.textContent=`${file.name} é maior que 20 MB.`;
          continue;
        }
        chosen.push(file);
      }
      if(!syncFiles()){
        chosen.length=0;
        feedback.textContent='O navegador não permite reunir as fotos. Experimente abrir a MID Store no Chrome ou Safari atualizado.';
        if(message)message.textContent='Seletor de arquivos incompatível com este navegador.';
        return;
      }
      render();
      if(message)message.textContent=`${chosen.length} foto(s) selecionada(s).`;
    }

    primary.addEventListener('change',()=>addFiles(primary));
    fallback.addEventListener('change',()=>{
      addFiles(fallback);
      fallback.value='';
    });
    // Garante que o arquivo anterior possa ser escolhido novamente.
    // Os arquivos acumulados são restaurados antes do envio.
    primary.addEventListener('click',()=>{primary.value=''});
    primary.addEventListener('cancel',()=>{
      syncFiles();
      if(!chosen.length)feedback.textContent='A seleção não retornou nenhuma foto. Tente a opção Arquivos.';
    });
    form.addEventListener('submit',event=>{
      if(chosen.length && !syncFiles()){
        event.preventDefault();
        event.stopImmediatePropagation();
        feedback.textContent='Este navegador não conseguiu anexar as fotos. Use o Chrome ou Safari atualizado.';
      }
    },true);
    form.addEventListener('reset',()=>{
      chosen.length=0;
      syncFiles();
      render();
    });
    render();
  }

  enhance();
  new MutationObserver(enhance).observe(document.body,{subtree:true,childList:true});
})();
