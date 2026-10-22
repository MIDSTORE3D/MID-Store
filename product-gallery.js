/* MID Store — Galeria de imagens para clientes.
   Deslizar na imagem principal troca a imagem sem afetar a rolagem vertical.
   Tocar abre um visualizador com pinça/arraste e navegação por swipe.
   Sem bibliotecas, sem backend, sem modificações no painel administrativo. */
(()=>{'use strict';
  let current=null;
  let lightbox=null;
  let restoreFocus=null;
  let restoreOverflow='';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  function setup(){
    const detail=document.querySelector('#view .detail');
    if(current && (!current.detail.isConnected || current.detail!==detail)){
      closeLightbox(false);
      current=null;
    }
    if(!detail || detail.dataset.midGalleryReady==='yes')return;
    const main=detail.querySelector('#mainphoto');
    const thumbs=[...detail.querySelectorAll('.thumbs [data-photo]')];
    if(!main)return;
    detail.dataset.midGalleryReady='yes';
    const urls=thumbs.length?thumbs.map(button=>button.dataset.photo):[main.getAttribute('src')];
    let index=Math.max(0,urls.indexOf(main.getAttribute('src')));
    let swipeStart=null;
    let ignoreClickUntil=0;
    const media=main.parentElement;

    main.setAttribute('role','button');
    main.setAttribute('tabindex','0');
    main.setAttribute('aria-label','Ampliar imagem do produto');
    main.setAttribute('title','Toque para ampliar a imagem');
    main.classList.add('mid-main-gallery-image');

    const controls=document.createElement('div');
    controls.className='mid-gallery-page-controls';
    controls.setAttribute('aria-label','Navegação pelas imagens');
    const left=document.createElement('button');
    left.type='button'; left.className='mid-gallery-page-btn'; left.textContent='‹';
    left.setAttribute('aria-label','Imagem anterior');
    const count=document.createElement('span');
    count.className='mid-gallery-page-counter'; count.setAttribute('aria-live','polite');
    const right=document.createElement('button');
    right.type='button'; right.className='mid-gallery-page-btn'; right.textContent='›';
    right.setAttribute('aria-label','Próxima imagem');
    if(urls.length>1){controls.append(left,count,right);main.after(controls)}
    const hint=document.createElement('div');
    hint.className='mid-gallery-tip';
    hint.textContent=urls.length>1?'Toque para ampliar · Deslize para trocar':'Toque para ampliar';
    if(urls.length)media.append(hint);

    function select(next){
      index=(next+urls.length)%urls.length;
      main.src=urls[index];
      thumbs.forEach((button,i)=>{
        button.classList.toggle('active',i===index);
        button.setAttribute('aria-pressed',String(i===index));
      });
      count.textContent=`${index+1} / ${urls.length}`;
    }
    const state={detail,urls,get index(){return index;},select};
    current=state;
    select(index);
    left.onclick=()=>select(index-1);
    right.onclick=()=>select(index+1);
    thumbs.forEach((button,i)=>button.addEventListener('click',()=>select(i)));

    main.addEventListener('click',()=>{
      if(Date.now()<ignoreClickUntil)return;
      openLightbox(state);
    });
    main.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();openLightbox(state)}
    });
    main.addEventListener('touchstart',event=>{
      if(event.touches.length!==1){swipeStart=null;return}
      swipeStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
    },{passive:true});
    main.addEventListener('touchend',event=>{
      if(!swipeStart||event.changedTouches.length!==1||event.touches.length)return;
      const dx=event.changedTouches[0].clientX-swipeStart.x;
      const dy=event.changedTouches[0].clientY-swipeStart.y;
      swipeStart=null;
      if(urls.length>1 && Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.35){
        ignoreClickUntil=Date.now()+500;
        select(index+(dx<0?1:-1));
      }
    },{passive:true});
    main.addEventListener('touchcancel',()=>{swipeStart=null},{passive:true});
  }

  function closeLightbox(returnFocus=true){
    if(!lightbox)return;
    const box=lightbox;
    lightbox=null;
    box.cleanup();
    box.root.remove();
    document.body.classList.remove('mid-gallery-open');
    document.body.style.overflow=restoreOverflow;
    if(returnFocus&&restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});
    restoreFocus=null;
  }

  function openLightbox(state){
    closeLightbox(false);
    const root=document.createElement('div');
    root.className='mid-zoom-overlay';
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','true');
    root.setAttribute('aria-label','Visualização ampliada das imagens do produto');
    const top=document.createElement('div');top.className='mid-zoom-top';
    const position=document.createElement('span');position.setAttribute('aria-live','polite');
    const close=document.createElement('button');close.type='button';close.className='mid-zoom-control';
    close.setAttribute('aria-label','Fechar imagem ampliada');close.textContent='✕';
    top.append(position,close);
    const stage=document.createElement('div');stage.className='mid-zoom-stage';
    stage.setAttribute('aria-label','Imagem ampliada: use dois dedos para aproximar e um dedo para mover');
    const img=document.createElement('img');img.className='mid-zoom-image';
    img.alt='Imagem do produto ampliada';img.draggable=false;
    stage.append(img);
    const bottom=document.createElement('div');bottom.className='mid-zoom-bottom';
    const prev=document.createElement('button');prev.className='mid-zoom-control mid-zoom-arrow';prev.textContent='‹';
    prev.setAttribute('aria-label','Imagem anterior');prev.type='button';
    const help=document.createElement('span');help.className='mid-zoom-help';
    help.textContent='Pinça para ampliar · Deslize para trocar';
    const next=document.createElement('button');next.className='mid-zoom-control mid-zoom-arrow';next.textContent='›';
    next.setAttribute('aria-label','Próxima imagem');next.type='button';
    const reset=document.createElement('button');reset.className='mid-zoom-control mid-zoom-reset';
    reset.textContent='Redefinir zoom';reset.type='button';
    bottom.append(prev,help,next,reset);
    root.append(top,stage,bottom);

    let index=state.index, scale=1, tx=0,ty=0;
    let gesture=null, pinchOccurred=false, lastTapAt=0;
    const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    const center=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
    function limitPan(){
      const maxX=Math.max(0,(img.offsetWidth*scale-stage.clientWidth)/2);
      const maxY=Math.max(0,(img.offsetHeight*scale-stage.clientHeight)/2);
      tx=clamp(tx,-maxX,maxX);ty=clamp(ty,-maxY,maxY);
    }
    function paint(){limitPan();img.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${scale})`;}
    function resetZoom(){scale=1;tx=0;ty=0;paint();}
    function show(i){
      if(!state.detail.isConnected){closeLightbox(false);return}
      index=(i+state.urls.length)%state.urls.length;
      state.select(index);
      img.src=state.urls[index];
      position.textContent=`Imagem ${index+1} de ${state.urls.length}`;
      resetZoom();
      gesture=null;
    }
    function advance(step){show(index+step)}
    function zoomAt(newScale,x,y){
      const rect=stage.getBoundingClientRect();
      const vx=x-(rect.left+rect.width/2), vy=y-(rect.top+rect.height/2);
      const factor=clamp(newScale,1,5)/scale;
      tx=vx-(vx-tx)*factor;
      ty=vy-(vy-ty)*factor;
      scale=clamp(newScale,1,5);
      if(scale===1){tx=0;ty=0}
      paint();
    }
    close.addEventListener('click',()=>closeLightbox());
    prev.addEventListener('click',()=>advance(-1));
    next.addEventListener('click',()=>advance(1));
    reset.addEventListener('click',resetZoom);
    if(state.urls.length<=1){prev.hidden=true;next.hidden=true;help.textContent='Pinça para ampliar · Arraste para mover';}
    root.addEventListener('click',e=>{if(e.target===root)closeLightbox()});

    stage.addEventListener('touchstart',e=>{
      if(e.touches.length>=2){
        e.preventDefault();pinchOccurred=true;
        const p=center(e.touches[0],e.touches[1]);
        gesture={type:'pinch',initialDistance:Math.max(1,dist(e.touches[0],e.touches[1])),initialScale:scale,startTx:tx,startTy:ty,startCenter:p};
      }else if(e.touches.length===1){
        const p=e.touches[0];gesture={type:'single',x:p.clientX,y:p.clientY,tx,ty,moved:false};
        pinchOccurred=false;
      }
    },{passive:false});
    stage.addEventListener('touchmove',e=>{
      if(e.touches.length>=2){
        e.preventDefault();
        if(!gesture||gesture.type!=='pinch'){
          const p=center(e.touches[0],e.touches[1]);
          gesture={type:'pinch',initialDistance:Math.max(1,dist(e.touches[0],e.touches[1])),initialScale:scale,startTx:tx,startTy:ty,startCenter:p};
        }
        const p=center(e.touches[0],e.touches[1]);
        const z=clamp(gesture.initialScale*dist(e.touches[0],e.touches[1])/gesture.initialDistance,1,5);
        const ratio=z/gesture.initialScale;
        const rect=stage.getBoundingClientRect();
        const ox=rect.left+rect.width/2,oy=rect.top+rect.height/2;
        tx=p.x-ox-(gesture.startCenter.x-ox-gesture.startTx)*ratio;
        ty=p.y-oy-(gesture.startCenter.y-oy-gesture.startTy)*ratio;
        scale=z;
        if(scale===1){tx=0;ty=0}
        paint();pinchOccurred=true;
      }else if(e.touches.length===1 && gesture?.type==='single'){
        e.preventDefault();
        const dx=e.touches[0].clientX-gesture.x,dy=e.touches[0].clientY-gesture.y;
        if(Math.abs(dx)+Math.abs(dy)>10)gesture.moved=true;
        if(scale>1){tx=gesture.tx+dx;ty=gesture.ty+dy;paint();}
      }
    },{passive:false});
    stage.addEventListener('touchend',e=>{
      if(e.touches.length>=2)return;
      if(e.touches.length===1){
        // Após a pinça, o dedo restante move a imagem, sem trocar de imagem.
        const p=e.touches[0];gesture={type:'single',x:p.clientX,y:p.clientY,tx,ty,moved:false};
        return;
      }
      if(gesture?.type==='single'&&!pinchOccurred){
        const p=e.changedTouches[0];
        const dx=p.clientX-gesture.x,dy=p.clientY-gesture.y;
        if(scale===1&&state.urls.length>1&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){
          advance(dx<0?1:-1);
          return;
        }
        if(!gesture.moved&&Date.now()-lastTapAt<300){
          scale>1?resetZoom():zoomAt(2.4,p.clientX,p.clientY);
          lastTapAt=0;
        }else if(!gesture.moved)lastTapAt=Date.now();
      }
      gesture=null;
      pinchOccurred=false;
    },{passive:true});
    stage.addEventListener('touchcancel',()=>{gesture=null;pinchOccurred=false;},{passive:true});
    stage.addEventListener('wheel',e=>{
      e.preventDefault();
      zoomAt(scale*(e.deltaY<0?1.18:1/1.18),e.clientX,e.clientY);
    },{passive:false});
    stage.addEventListener('dblclick',e=>{scale>1?resetZoom():zoomAt(2.4,e.clientX,e.clientY)});
    // Mouse: arrastar imagem ampliada no computador.
    let dragging=null;
    stage.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'||scale<=1)return;
      dragging={x:e.clientX,y:e.clientY,tx,ty};
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove',e=>{
      if(!dragging||e.pointerType==='touch')return;
      tx=dragging.tx+e.clientX-dragging.x;ty=dragging.ty+e.clientY-dragging.y;paint();
    });
    stage.addEventListener('pointerup',()=>{dragging=null});
    stage.addEventListener('pointercancel',()=>{dragging=null});
    const onKey=e=>{
      if(e.key==='Escape'){e.preventDefault();closeLightbox()}
      else if(e.key==='ArrowRight'){e.preventDefault();advance(1)}
      else if(e.key==='ArrowLeft'){e.preventDefault();advance(-1)}
      else if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(scale*1.25,innerWidth/2,innerHeight/2)}
      else if(e.key==='-'){e.preventDefault();zoomAt(scale/1.25,innerWidth/2,innerHeight/2)}
    };
    document.addEventListener('keydown',onKey);
    lightbox={root,cleanup(){document.removeEventListener('keydown',onKey)}};
    restoreFocus=document.activeElement;
    restoreOverflow=document.body.style.overflow;
    document.body.classList.add('mid-gallery-open');
    document.body.style.overflow='hidden';
    document.body.append(root);
    show(index);
    close.focus();
  }

  setup();
  const observer=new MutationObserver(setup);
  observer.observe(document.querySelector('#view')||document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{if(lightbox)closeLightbox(false)});
})();
