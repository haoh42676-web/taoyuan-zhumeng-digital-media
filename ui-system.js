/* Shared behavior: themes, native disclosures, readable streaming and copy feedback. */
(()=>{'use strict';
 const key='peach-digital-media-ui-theme:v1',root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const listenMedia=(query,listener)=>{if(query.addEventListener){query.addEventListener('change',listener);return()=>query.removeEventListener('change',listener);}if(query.addListener){query.addListener(listener);return()=>query.removeListener(listener);}return()=>{};};
 function theme(){
  root.dataset.theme='light';try{localStorage.removeItem(key);}catch{}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#eef2ee');
  window.dispatchEvent(new CustomEvent('peach:themechange',{detail:{theme:'light'}}));
 }
 theme();window.addEventListener('storage',e=>{if(e.key===key)theme();});
 const closures=new WeakMap(),openFrames=new WeakMap(),openFallbacks=new WeakMap();
 function finishClose(d){if(d.dataset.expanded==='false')d.open=false;}
 function setDisclosure(d,expanded){
  enhanceDisclosure(d);clearTimeout(closures.get(d));clearTimeout(openFallbacks.get(d));cancelAnimationFrame(openFrames.get(d));delete d.dataset.uiOpening;
  const wasClosed=!d.open;
  d.querySelector(':scope>summary').setAttribute('aria-expanded',String(expanded));d.querySelector(':scope>.ui-disclosure-body').inert=!expanded;
  if(expanded&&wasClosed){d.dataset.uiOpening='true';d.open=true;const reveal=()=>{if(!d.dataset.uiOpening)return;clearTimeout(openFallbacks.get(d));delete d.dataset.uiOpening;d.dataset.expanded='true';};openFrames.set(d,requestAnimationFrame(()=>{openFrames.set(d,requestAnimationFrame(reveal));}));openFallbacks.set(d,setTimeout(reveal,60));}
  else d.dataset.expanded=String(expanded);
  if(!expanded){if(reduced.matches)finishClose(d);else closures.set(d,setTimeout(()=>finishClose(d),260));}
 }
 function enhanceDisclosure(d){
  if(d.dataset.uiDisclosure)return;const summary=d.querySelector(':scope>summary');if(!summary)return;
  d.dataset.uiDisclosure='1';const body=document.createElement('div'),inner=document.createElement('div');body.className='ui-disclosure-body';inner.className='ui-disclosure-inner';body.append(inner);
  [...d.childNodes].filter(n=>n!==summary).forEach(n=>inner.append(n));d.append(body);d.dataset.expanded=String(d.open);summary.setAttribute('aria-expanded',String(d.open));body.inert=!d.open;
  summary.addEventListener('click',e=>{e.preventDefault();setDisclosure(d,d.dataset.expanded!=='true');});
  body.addEventListener('transitionend',e=>{if(e.target===body&&e.propertyName==='grid-template-rows')finishClose(d);});
  d.addEventListener('toggle',()=>{if(d.dataset.uiOpening)return;if(d.open&&d.dataset.expanded!=='true'){d.dataset.expanded='true';summary.setAttribute('aria-expanded','true');body.inert=false;}else if(!d.open){d.dataset.expanded='false';summary.setAttribute('aria-expanded','false');body.inert=true;}});
 }
 const feedbackTimers=new WeakMap();let liveStatus;
 function announce(message){if(!liveStatus){liveStatus=document.createElement('div');liveStatus.className='ui-sr-only';liveStatus.setAttribute('role','status');liveStatus.setAttribute('aria-live','polite');liveStatus.setAttribute('aria-atomic','true');document.body.append(liveStatus);}liveStatus.textContent='';requestAnimationFrame(()=>{liveStatus.textContent=message;});}
 function copied(button){
  if(!button?.isConnected)return;clearTimeout(feedbackTimers.get(button));
  if(!button.dataset.copyFeedback){button.dataset.copyFeedback='true';button.dataset.copyOriginal=button.innerHTML;button.dataset.copyLabel=button.getAttribute('aria-label')||'';}
  button.classList.add('copy-feedback');button.setAttribute('aria-label','已复制');announce('已复制到剪贴板');
  const label=document.createElement('span');label.className='copy-feedback-label ui-pop';label.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>已复制</span>';
  button.querySelector('.copy-feedback-label')?.remove();button.append(label);
  function hide(){if(!button.isConnected)return;button.innerHTML=button.dataset.copyOriginal;if(button.dataset.copyLabel)button.setAttribute('aria-label',button.dataset.copyLabel);else button.removeAttribute('aria-label');button.classList.remove('copy-feedback');delete button.dataset.copyFeedback;delete button.dataset.copyOriginal;delete button.dataset.copyLabel;}
  feedbackTimers.set(button,setTimeout(hide,2500));
 }
 const activeStreams=new WeakMap();
 function streamText(target,text,{signal}={}){
  activeStreams.get(target)?.();target.textContent='';const chars=Array.from(String(text)),item=target.closest('.chat-message,.message');
  if(reduced.matches||signal?.aborted||!chars.length){target.textContent=text;return Promise.resolve();}
  if(item)item.dataset.streaming='true';target.setAttribute('aria-hidden','true');
  const fragment=document.createDocumentFragment();chars.forEach((char,i)=>{const span=document.createElement('span');span.className='ink-token';span.style.setProperty('--token-index',i);span.textContent=char;fragment.append(span);});target.append(fragment);
  const controls=document.createElement('div');controls.className='stream-controls';const note=document.createElement('span');note.textContent='正在显示回答';const show=document.createElement('button');show.type='button';show.textContent='立即显示';controls.append(note,show);target.after(controls);
  return new Promise(resolve=>{let timer,done=false,unlisten=()=>{};const finish=()=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',finish);unlisten();target.textContent=text;target.removeAttribute('aria-hidden');if(item)delete item.dataset.streaming;controls.remove();activeStreams.delete(target);resolve();};const motion=()=>{if(reduced.matches)finish();};activeStreams.set(target,finish);show.addEventListener('click',finish);signal?.addEventListener('abort',finish,{once:true});unlisten=listenMedia(reduced,motion);timer=setTimeout(finish,(chars.length-1)*30+120);});
 }
 // Overdamped, unit-mass analytical spring. Zero release velocity keeps the path monotonic.
 const SPRING_PHYSICS=Object.freeze({drag:Object.freeze({stiffness:1200,damping:80}),click:Object.freeze({stiffness:420,damping:20})});
 const panelStates=new WeakMap(),panelElements=new Set(),desktop=matchMedia('(min-width: 721px) and (pointer: fine)');
 const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
 function panelState(panel){let state=panelStates.get(panel);if(!state){state={x:0,y:0,frame:0};panelStates.set(panel,state);panelElements.add(panel);}return state;}
 function positionPanel(panel,x,y){const s=panelState(panel);s.x=x;s.y=y;panel.style.setProperty('--ui-panel-x',x+'px');panel.style.setProperty('--ui-panel-y',y+'px');}
 function springPanel(panel,{x=0,y=0}={}){
  const s=panelState(panel);cancelAnimationFrame(s.frame);const from={x:s.x,y:s.y};
  if(reduced.matches){positionPanel(panel,x,y);s.frame=0;return;}
  const {stiffness,damping}=SPRING_PHYSICS.drag,root=Math.sqrt(damping*damping-4*stiffness),r1=(-damping+root)/2,r2=(-damping-root)/2,start=performance.now();
  const remaining=t=>(-r2*Math.exp(r1*t)+r1*Math.exp(r2*t))/(r1-r2);
  const step=now=>{const decay=remaining((now-start)/1000);positionPanel(panel,x+(from.x-x)*decay,y+(from.y-y)*decay);if(Math.max(Math.abs((from.x-x)*decay),Math.abs((from.y-y)*decay))>.1)s.frame=requestAnimationFrame(step);else{positionPanel(panel,x,y);s.frame=0;}};s.frame=requestAnimationFrame(step);
 }
 function enhancePanel(panel){
  if(panel.dataset.uiPanel)return;const handle=panel.querySelector('.chat-heading,[data-panel-handle]');if(!handle)return;panel.dataset.uiPanel='1';panel.classList.add('ui-draggable-panel');handle.classList.add('ui-panel-handle');handle.tabIndex=desktop.matches?0:-1;handle.setAttribute('aria-label','客服窗口位置；可拖动，或用方向键移动，Home键居中');handle.title='拖动窗口 · 方向键微调 · Home居中';
  const s=panelState(panel);let drag;
  const bounds=()=>{const rect=panel.getBoundingClientRect();return{left:16-(rect.left-s.x),right:innerWidth-16-(rect.right-s.x),top:12-(rect.top-s.y),bottom:innerHeight-12-(rect.bottom-s.y)};};
  const done=e=>{if(!drag||e.pointerId!==drag.pointer)return;drag=null;delete panel.dataset.uiDragging;const b=bounds();if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);const center=(b.left+b.right)/2;const x=Math.abs(s.x-center)<48?center:(s.x<center?b.left:b.right);springPanel(panel,{x,y:clamp(s.y,b.top,b.bottom)});};
  handle.addEventListener('pointerdown',e=>{if(!desktop.matches||e.button!==0||e.target.closest('button,a,input,select,textarea'))return;cancelAnimationFrame(s.frame);drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:s.x,startY:s.y};panel.dataset.uiDragging='true';handle.setPointerCapture(e.pointerId);e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;const b=bounds();positionPanel(panel,clamp(drag.startX+e.clientX-drag.x,b.left,b.right),clamp(drag.startY+e.clientY-drag.y,b.top,b.bottom));});
  handle.addEventListener('pointerup',done);handle.addEventListener('pointercancel',e=>{if(!drag||e.pointerId!==drag.pointer)return;drag=null;delete panel.dataset.uiDragging;springPanel(panel,{x:s.x,y:s.y});});
  handle.addEventListener('keydown',e=>{if(e.target!==handle||!desktop.matches||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();const b=bounds();springPanel(panel,e.key==='Home'?{x:0,y:0}:{x:clamp(s.x+(e.key==='ArrowLeft'?-24:e.key==='ArrowRight'?24:0),b.left,b.right),y:clamp(s.y+(e.key==='ArrowUp'?-24:e.key==='ArrowDown'?24:0),b.top,b.bottom)});});
  panel.addEventListener('close',()=>{drag=null;delete panel.dataset.uiDragging;cancelAnimationFrame(s.frame);positionPanel(panel,0,0);});
 }
 const overlayOpeners=new WeakMap();let lastActivator;
 let scrollLock=null,viewportFrame=0,viewportBaseline=innerHeight,viewportWidth=innerWidth;
 const lockProperties=['position','top','left','right','width','overflow','paddingRight'];
 function syncDialogScroll(){
  const opened=document.querySelector('dialog[open]');
  if(opened&&!scrollLock){const body=document.body,gap=Math.max(0,innerWidth-root.clientWidth);scrollLock={x:scrollX,y:scrollY,body:Object.fromEntries(lockProperties.map(key=>[key,body.style[key]])),overflow:root.style.overflow,behavior:root.style.scrollBehavior};root.style.overflow='hidden';root.style.scrollBehavior='auto';Object.assign(body.style,{position:'fixed',top:-scrollLock.y+'px',left:'0',right:'0',width:'100%',overflow:'hidden'});if(gap)body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+gap)+'px';}
  else if(!opened&&scrollLock){const saved=scrollLock;scrollLock=null;Object.assign(document.body.style,saved.body);root.style.overflow=saved.overflow;window.scrollTo({left:saved.x,top:saved.y,behavior:'auto'});root.style.scrollBehavior=saved.behavior;}
  scheduleDialogViewport();
 }
 function scheduleDialogViewport(){cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(fitEditedDialog);}
 function fitEditedDialog(){
  document.querySelectorAll('dialog[data-ui-keyboard]').forEach(dialog=>{delete dialog.dataset.uiKeyboard;dialog.style.removeProperty('--ui-visible-height');dialog.style.removeProperty('--ui-visible-top');});
  const viewport=window.visualViewport,active=document.activeElement,dialog=active?.closest('dialog[open]'),editable=active?.matches('textarea:not([readonly]):not([disabled]),input:not([type=checkbox]):not([type=radio]):not([readonly]):not([disabled]),[contenteditable=true]');
  if(!viewport)return;
  if(Math.abs(innerWidth-viewportWidth)>80){viewportWidth=innerWidth;viewportBaseline=Math.max(innerHeight,viewport.height);}
  viewportBaseline=Math.max(viewportBaseline,viewport.height);
  if(!editable){viewportBaseline=Math.max(innerHeight,viewport.height);return;}
  // Only the edited modal follows a reduced visual viewport. Pinch zoom stays native.
  if(!dialog||viewport.scale>1.01||Math.max(viewportBaseline,innerHeight)-viewport.height<110)return;
  dialog.dataset.uiKeyboard='true';dialog.style.setProperty('--ui-visible-height',Math.max(180,viewport.height)+'px');dialog.style.setProperty('--ui-visible-top',Math.max(0,viewport.offsetTop)+'px');
 }
 const visible=element=>element?.isConnected&&element.getClientRects().length&&!element.closest('[inert]');
 function restoreFocus(overlay){const opener=overlayOpeners.get(overlay);queueMicrotask(()=>{const active=document.activeElement;if(document.querySelector('dialog[open]')&&!opener?.closest('dialog[open]'))return;if(visible(opener)&&(!active||active===document.body||active===document.documentElement||overlay.contains(active)))opener.focus({preventScroll:true});});}
 function enhanceOverlay(overlay){
  if(overlay.dataset.uiOverlay)return;overlay.dataset.uiOverlay='1';
  overlay.addEventListener('beforetoggle',e=>{if(e.newState==='open')overlayOpeners.set(overlay,e.source||((document.activeElement!==document.body&&!overlay.contains(document.activeElement))?document.activeElement:lastActivator));});
  overlay.addEventListener('toggle',e=>{if(e.newState==='open'&&!overlayOpeners.has(overlay))overlayOpeners.set(overlay,lastActivator);if(e.newState==='closed'&&overlay.tagName!=='DIALOG')restoreFocus(overlay);});
  if(overlay.tagName==='DIALOG')overlay.addEventListener('close',()=>{syncDialogScroll();restoreFocus(overlay);});
  if(overlay.id==='ai-chat'||overlay.hasAttribute('data-draggable-panel'))enhancePanel(overlay);
 }
 function enhanceNode(node){if(node.matches('details'))enhanceDisclosure(node);node.querySelectorAll('details').forEach(enhanceDisclosure);if(node.matches('dialog,[popover]'))enhanceOverlay(node);node.querySelectorAll('dialog,[popover]').forEach(enhanceOverlay);}
 function sidebarState(){const sidebar=document.querySelector('#sidebar'),toggle=document.querySelector('.menu-toggle[data-action=menu]');if(!sidebar||!toggle)return;toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded',String(sidebar.classList.contains('open')));}
 function closeSidebar(restore=false){const sidebar=document.querySelector('#sidebar.open');if(!sidebar)return;sidebar.classList.remove('open');sidebarState();if(restore)document.querySelector('.menu-toggle[data-action=menu]')?.focus({preventScroll:true});}
 function init(){
  theme(root.dataset.theme);enhanceNode(document.body);sidebarState();
  const skip=document.createElement('a');skip.className='ui-skip-link';skip.href=document.querySelector('#app')?'#app':'#main-content';skip.textContent='跳至主要内容';skip.addEventListener('click',e=>{e.preventDefault();const target=['#main-content','#app','main','#login-form'].map(s=>document.querySelector(s)).find(visible);if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});}});document.body.prepend(skip);
  document.addEventListener('click',e=>{const active=e.target.closest('button,a,input,summary,[tabindex]');if(active)lastActivator=active;if(desktop.matches||e.target.closest('#sidebar,.menu-toggle')||document.querySelector('dialog[open]'))return;closeSidebar();},true);
  // Keep an edited modal still between press and click. Blur would otherwise
  // dismiss the keyboard and move the clicked close/send button under the pointer.
  const keepEditorFocus=e=>{if(e.button!==0||e.defaultPrevented)return;const button=e.target.closest('button'),active=document.activeElement,modal=active?.closest('dialog[open]');if(button&&modal&&button.closest('dialog[open]')===modal&&active.matches('textarea:not([readonly]):not([disabled]),input:not([type=checkbox]):not([type=radio]):not([readonly]):not([disabled]),[contenteditable=true]'))e.preventDefault();};
  document.addEventListener('pointerdown',keepEditorFocus,{capture:true,passive:false});document.addEventListener('mousedown',keepEditorFocus,{capture:true,passive:false});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented&&!document.querySelector('dialog[open]')&&document.querySelector('#sidebar.open')){closeSidebar(true);e.preventDefault();}});
  const resetPanels=()=>{for(const panel of panelElements){cancelAnimationFrame(panelState(panel).frame);positionPanel(panel,0,0);const handle=panel.querySelector('.ui-panel-handle');if(handle)handle.tabIndex=desktop.matches?0:-1;}};window.addEventListener('resize',resetPanels);listenMedia(desktop,resetPanels);listenMedia(reduced,()=>{if(reduced.matches)resetPanels();});
  window.addEventListener('resize',scheduleDialogViewport);window.visualViewport?.addEventListener('resize',scheduleDialogViewport);window.visualViewport?.addEventListener('scroll',scheduleDialogViewport);document.addEventListener('focusin',scheduleDialogViewport);document.addEventListener('focusout',scheduleDialogViewport);
  new MutationObserver(records=>{let dialogsChanged=false;for(const record of records){if(record.type==='attributes'){if(record.attributeName==='open')dialogsChanged=true;else sidebarState();continue;}for(const n of record.addedNodes){if(n.nodeType===1)enhanceNode(n);}}if(dialogsChanged)syncDialogScroll();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open']});
 }
 window.PeachUI={theme,copied,streamText,setDisclosure,springPanel,springPhysics:SPRING_PHYSICS};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
