import {mountProductDetail} from './product-detail.js?v=p31vis1';
import {mountDesignCollection} from './design-collection.js?v=p33curated1';
import {mountStudioLive} from './studio-live.js?v=p35photo1';
import {getProducts,resolveRail,typeLabel} from './product-store.js?v=p31vis1';
import {presetDesign} from './catalog-filter.js?v=p31vis1';
import {mountCatalog} from './product-catalog.js?v=p31vis1';
import {mountStyling} from './styling.js?v=p34real1';
import {mountHeatPress} from './heat-press.js?v=p31vis1';
import {mountCart} from './cart.js?v=p31vis1';
import {mountStudio} from './studio.js?v=p31vis1';
import {mountShowroom} from './circular-showroom.js?v=p31vis1';
import {GarmentController} from './controller.js?v=p31vis1';
import {rackPositions,slideStep} from './rack-layout.js?v=p31vis1';
import {mobileRailPositions,mobileSwipeDestination} from './mobile-rail.js?v=p31vis1';
import {validateCatalog,validateManifest} from './catalog.js?v=p31vis1';

const $=selector=>document.querySelector(selector);
const rack=$('#rack'),holder=$('#rack-items');
const mobile=matchMedia('(max-width:700px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let showroom;
const cart=mountCart({onEdit:(design,id)=>studio.restore(design,id)});
const studio=mountStudio({onAdd:(design,previews,id)=>cart.add(design,previews,id)});
const productDetail=mountProductDetail(studio);mountCatalog(studio,productDetail);mountDesignCollection(studio);mountStudioLive(studio);
const styling=mountStyling(studio);
const heatPress=mountHeatPress(studio,{tryOn:()=>styling.open()});
document.querySelector('#studio-try').onclick=()=>styling.open();
document.querySelector('#studio-press').onclick=()=>heatPress.open();
let motionIntent=false;
let allProducts=[];
let catalog,states=[],active=-1,selected=0,pending=-1,intentTimer,ready=false,raf=0,lastTime=0,drag=null,railOffset=0,railVelocity=0,suppressClickUntil=0;
const manifestUrl=item=>new URL('../public/'+item.motion,import.meta.url);
const assetUrl=(item,file)=>new URL(file,manifestUrl(item));
function updateInfo(index){
  selected=index;showroom?.select(allProducts.findIndex(p=>p.sku===catalog.items[index].sku));const item=catalog.items[index];
  $('#selected-index').textContent=String(index+1).padStart(2,'0')+' / '+String(states.length).padStart(2,'0');
  $('#selected-name').textContent=item.name;$('#selected-type').textContent=[typeLabel(item.type),item.color, new Intl.NumberFormat('vi-VN').format(item.basePrice)+'đ'].join(' · ');
  $('#previous').disabled=!ready||index===0;$('#next').disabled=!ready||index===states.length-1;
}
function paint(s,frame){
  if(!s.image){if(s.fallback)s.fallback.src=new URL('../'+(frame>s.manifest.frameCount/2?s.product.front:s.product.profile),import.meta.url).href;return;}
  const {width:w,height:h,columns}=s.manifest;
  s.ctx.clearRect(0,0,w,h);s.ctx.drawImage(s.image,(frame%columns)*w,Math.floor(frame/columns)*h,w,h,0,0,w,h);
  s.button.dataset.frame=String(frame);
}
function activate(index){
  if(!ready)return;
  active=index;
  states.forEach((s,i)=>{s.button.classList.toggle('active',i===index);s.controller.setTarget(i===index?1:0,{immediate:reduced.matches});});
  if(index>=0){updateInfo(index);if(motionIntent)ensureMotion(index);}
  wake();
}
function cancelIntent(){clearTimeout(intentTimer);intentTimer=undefined;pending=-1;}
function intend(index){
  motionIntent=true;
  if(!ready||pending===index||active===index)return;
  cancelIntent();pending=index;
  if(index<0){activate(-1);return;}
  intentTimer=setTimeout(()=>{pending=-1;activate(index);},catalog.timing.intentMs);
}
function targets(){
  const width=rack.clientWidth,garmentWidth=states[0]?.displayWidth||370;
  if(mobile.matches)return mobileRailPositions({width,items:states.map(s=>({half:s.displayWidth*(.08+.35*s.controller.position)})),focus:selected,offset:railOffset,gap:12});
  return rackPositions({count:states.length,width,garmentWidth,active,minimumSpread:35});
}
function tick(time){
  const dt=lastTime?Math.min(50,time-lastTime):0;lastTime=time;
  let moving=false;
  if(mobile.matches&&!drag){
    const next=slideStep(railOffset,railVelocity,0,dt,23);railOffset=next.position;railVelocity=next.velocity;
    moving ||=Math.abs(railOffset)>.03||Math.abs(railVelocity)>.2;
    if(!moving&&active!==selected&&!drag)activate(selected);
  }
  for(const s of states)moving=s.controller.step(dt)||moving;
  const positions=targets();
  states.forEach((s,i)=>{
    const next=reduced.matches?{position:positions[i],velocity:0}:slideStep(s.position,s.velocity,positions[i],dt,active<0?22:20);
    s.position=next.position;s.velocity=next.velocity;s.button.style.left=s.position+'px';
    moving ||=Math.abs(s.position-positions[i])>.03||Math.abs(s.velocity)>.2;
  });
  if(moving)raf=requestAnimationFrame(tick);else{raf=0;lastTime=0;}
}
function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
function stop(){cancelAnimationFrame(raf);raf=0;lastTime=0;}
function layout(){
  if(!states.length)return;
  const displayWidth=mobile.matches?Math.min(345,innerWidth-20):innerWidth>=1400?440:410;
  states.forEach(s=>{s.displayWidth=displayWidth;s.button.style.setProperty('--garment-width',displayWidth+'px');});
  $('#interaction-hint').textContent=mobile.matches?'Vuốt để khám phá · Chạm để xem áo':'Rê để xoay áo · Bấm để xem chi tiết';
  cancelIntent();drag=null;railOffset=0;railVelocity=0;
  const positions=targets();states.forEach((s,i)=>{s.position=positions[i];s.velocity=0;s.button.style.left=s.position+'px';});
  activate(selected);wake();
}
function hitAt(x){
  let nearest=-1,best=Infinity;
  states.forEach((s,i)=>{const d=Math.abs(x-s.position),half=i===active?s.displayWidth*.43:30;if(d<=half&&d<best){nearest=i;best=d;}});
  return nearest;
}
rack.addEventListener('pointermove',event=>{
  if(!ready||$('#product-dialog').open||$('#about-dialog').open)return;
  if(drag&&event.pointerId===drag.id){
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.horizontal&&Math.abs(dx)>7&&Math.abs(dx)>Math.abs(dy)*1.2){drag.horizontal=true;rack.setPointerCapture(event.pointerId);cancelIntent();activate(-1);}
    if(!drag.horizontal)return;
    const now=performance.now();drag.velocity=(event.clientX-drag.lastX)/Math.max(1,now-drag.lastTime);drag.lastX=event.clientX;drag.lastTime=now;
    railOffset=dx;railVelocity=0;wake();return;
  }
  if(!mobile.matches&&event.pointerType!=='touch')intend(hitAt(event.clientX-rack.getBoundingClientRect().left));
});
rack.addEventListener('pointerleave',()=>{if(!mobile.matches&&!drag){cancelIntent();activate(selected);}});
rack.addEventListener('pointerdown',event=>{
  if(!ready||!mobile.matches||event.button!==0)return;
  motionIntent=true;$('#interaction-hint').classList.add('used');
  const now=performance.now();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastTime:now,velocity:0,horizontal:false};
});
function endDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  const previous=drag;drag=null;
  if(previous.horizontal){
    const width=rack.clientWidth,positions=targets();
    const next=mobileSwipeDestination({positions,width,focus:selected,delta:railOffset,velocity:previous.velocity});
    const offset=positions[next]-width/2;selected=next;railOffset=offset;railVelocity=0;updateInfo(next);suppressClickUntil=performance.now()+450;
    if(rack.hasPointerCapture(event.pointerId))rack.releasePointerCapture(event.pointerId);
    if(reduced.matches)railOffset=0;
    wake();
  }
}
rack.addEventListener('pointerup',endDrag);rack.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId){drag=null;railOffset=0;railVelocity=0;wake();}});
rack.addEventListener('click',event=>{
  if(!ready||performance.now()<suppressClickUntil)return;
  const button=event.target.closest('.garment');if(!button)return;
  const index=Number(button.dataset.index);
  if(mobile.matches&&index!==selected){browse(index);return;}
  openProduct(index);
});
function browse(index){
  motionIntent=true;
  if(!ready)return;
  index=Math.max(0,Math.min(states.length-1,index));cancelIntent();
  if(mobile.matches){const p=targets();railOffset=p[index]-rack.clientWidth/2;railVelocity=0;selected=index;activate(-1);if(reduced.matches)railOffset=0;updateInfo(index);wake();}
  else activate(index);
}
$('#previous').addEventListener('click',()=>browse(selected-1));$('#next').addEventListener('click',()=>browse(selected+1));
$('#inspect').addEventListener('click',()=>openProduct(selected));
function showDetail(item){showroom?.select(allProducts.findIndex(p=>p.sku===item.sku));productDetail.open(item)}
function openProduct(index){if(!ready)return;motionIntent=true;cancelIntent();activate(index);showDetail(catalog.items[index])}

document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
$('#about-open').addEventListener('click',()=>{cancelIntent();$('#about-dialog').showModal();});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>{if(!mobile.matches)activate(selected);});
  dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
});
addEventListener('resize',layout);mobile.addEventListener('change',layout);reduced.addEventListener('change',()=>activate(active));
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelIntent();stop();}else wake();});
async function ensureMotion(index){
 const s=states[index];if(!s||s.motionPromise||s.unavailable)return; s.motionPromise=(async()=>{try{const image=new Image();image.src=assetUrl(s.product,s.manifest.atlas).href;await image.decode();if(image.naturalWidth!==s.manifest.width*s.manifest.columns)throw Error('Motion size');s.image=image;s.button.classList.add('ready');if(active===index&&!reduced.matches){s.controller.setTarget(0,{immediate:true});s.controller.setTarget(1)}paint(s,s.controller.frame);wake()}catch{s.unavailable=true;s.button.dataset.motion='static';s.fallback.src=new URL('../'+s.product.front,import.meta.url).href;$('#rail-status').textContent='Một mẫu đang hiển thị ảnh tĩnh. Bạn vẫn có thể xem và cá nhân hóa áo.'}})();
 return s.motionPromise;
}
async function boot(){
 try{
 const response=await fetch(new URL('../config/catalog.json',import.meta.url));if(!response.ok)throw Error('config');const config=validateCatalog(await response.json());allProducts=await getProducts();catalog={...config,items:resolveRail(config,allProducts)};
 for(const [i,item]of catalog.items.entries()){
 let manifest;try{const r=await fetch(manifestUrl(item));if(!r.ok)throw Error('missing');manifest=validateManifest(await r.json())}catch{manifest={width:384,height:448,columns:6,frameCount:30,atlas:'atlas.webp',front:'front.webp',profile:'profile.webp',unavailable:true}}
 const button=document.createElement('button');button.className='garment';button.dataset.index=String(i);button.dataset.productId=item.sku;button.setAttribute('aria-label','Xem '+item.name);
 const wire=document.createElement('span');wire.className='wire';wire.setAttribute('aria-hidden','true');const fallback=new Image();fallback.src=new URL('../'+(i===0?item.front:item.profile),import.meta.url).href;fallback.alt='';fallback.width=manifest.width;fallback.height=manifest.height;fallback.onerror=()=>{if(!fallback.dataset.retried){fallback.dataset.retried='true';fallback.src=new URL('../'+item.front,import.meta.url).href}};
 const canvas=document.createElement('canvas');canvas.width=manifest.width;canvas.height=manifest.height;canvas.setAttribute('aria-hidden','true');button.append(wire,fallback,canvas);holder.append(button);
 const state={button,manifest,canvas,fallback,product:item,ctx:canvas.getContext('2d'),image:null,position:0,velocity:0,displayWidth:370,unavailable:!!manifest.unavailable};state.controller=new GarmentController({frameCount:manifest.frameCount,durationMs:catalog.timing.turnMs,returnDurationMs:catalog.timing.returnMs,endpointWindow:catalog.timing.endpointWindow,onFrame:frame=>paint(state,frame)});
 button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))browse(i)});button.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=Math.max(0,Math.min(states.length-1,i+(e.key==='ArrowRight'?1:-1)));states[n].button.focus();browse(n)}});states.push(state);
 }
 states[0].controller.setTarget(1,{immediate:true});ready=true;rack.setAttribute('aria-busy','false');$('#load-state').hidden=true;$('#inspect').disabled=false;updateInfo(0);layout();
 const circularOption=$('#circular-option');let circleLoading=false;async function openCircle(){if(!circularOption.open||showroom||circleLoading)return;circleLoading=true;await Promise.all(allProducts.map(p=>studio.prepare(presetDesign(p))));showroom=mountShowroom({items:allProducts,frontUrl:i=>allProducts[i].photoBase?new URL('../'+allProducts[i].front,import.meta.url).href:studio.mockup(presetDesign(allProducts[i])),onSelect:(i,inspect)=>{const p=allProducts[i],railIndex=catalog.items.findIndex(r=>r.sku===p.sku);if(railIndex>=0)browse(railIndex);if(inspect)showDetail(p)}});showroom.select(allProducts.findIndex(p=>p.sku===catalog.items[selected].sku));}circularOption.addEventListener('toggle',openCircle);openCircle();document.documentElement.dataset.ready='true';
 }catch{$('#load-text').textContent='Tủ áo chưa tải xong. Bạn vẫn có thể tự thiết kế ở phía dưới.';$('#load-counter').textContent='';rack.setAttribute('aria-busy','false');}
}
boot();

const realPhotoObserver=new IntersectionObserver(es=>{for(const e of es){if(e.isIntersecting){e.target.src=e.target.dataset.src;realPhotoObserver.unobserve(e.target)}}},{rootMargin:'400px'});document.querySelectorAll('#real-photos img[data-src]').forEach(i=>realPhotoObserver.observe(i));
document.querySelector('#hero-design').onclick=()=>studio.focus();
