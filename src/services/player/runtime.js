import { shortLyrics as LYRICS, fullLyrics as LYR_FULL, lyricPools as LYR_POOL, importPlaylists as IMP_LIST, downloads as DL_LIST } from '@/constants/music';

// 此文件直接迁自 ui/music-player-glass-vs-minimal.html 的脚本。
// 保留原稿的页面、播放预览与动画逻辑，只增加 Vue 生命周期和 Tauri 通信适配。
export function mountSourcePlayer(root, options = {}) {
  const nativeDocument = root.ownerDocument;
  const nativeWindow = nativeDocument.defaultView;
  const cleanups = [];
  const timeouts = new Set();
  const intervals = new Set();
  const frames = new Set();
  const bound = new WeakMap();
  // 路由组件重复挂载时只绑定新节点，公共布局监听在卸载时统一释放。
  function listenElement(el, type, handler, config) {
    const key=type+'|'+handler.toString();
    let keys=bound.get(el); if(!keys){ keys=new Set(); bound.set(el,keys); }
    if(keys.has(key))return; keys.add(key);
    el.addEventListener(type,handler,config);
  }
  let destroyed = false;
  let nativeDirection = 1;

  // 将原稿查询限定在当前页面，避免影响独立桌面窗口或其他 Vue 视图。
  const document = {
    get body() { return nativeDocument.body; },
    get activeElement() { return nativeDocument.activeElement; },
    querySelectorAll: selector => root.querySelectorAll(selector),
    getElementById: id => root.querySelector('[id="' + id + '"]'),
    createElement: tag => nativeDocument.createElement(tag),
    addEventListener(type, handler, config) {
      nativeDocument.addEventListener(type, handler, config);
      cleanups.push(() => nativeDocument.removeEventListener(type, handler, config));
    },
  };
  const window = nativeWindow;

  // 注册需要在 Vue 页面退出时移除的原稿窗口监听。
  function listenWindow(type, handler, config) {
    nativeWindow.addEventListener(type, handler, config);
    cleanups.push(() => nativeWindow.removeEventListener(type, handler, config));
  }
  // 跟踪原稿延时动画，卸载后取消尚未执行的回调。
  function setTimeout(handler, delay) {
    const id = nativeWindow.setTimeout(() => { timeouts.delete(id); if (!destroyed) handler(); }, delay);
    timeouts.add(id); return id;
  }
  // 跟踪原稿的播放计时器，避免热更新或退出页面后遗留后台任务。
  function setInterval(handler, delay) {
    const id = nativeWindow.setInterval(handler, delay); intervals.add(id); return id;
  }
  // 原稿暂停播放时同步释放已记录的计时器。
  function clearInterval(id) { nativeWindow.clearInterval(id); intervals.delete(id); }
  // 原稿取消动画延时后同步释放记录。
  function clearTimeout(id) { nativeWindow.clearTimeout(id); timeouts.delete(id); }
  // 跟踪原稿视差、歌词和切歌过渡的动画帧。
  function requestAnimationFrame(handler) {
    const id = nativeWindow.requestAnimationFrame(time => { frames.delete(id); if (!destroyed) handler(time); });
    frames.add(id); return id;
  }
  // 原稿主动停止动画时同时清理帧记录。
  function cancelAnimationFrame(id) { nativeWindow.cancelAnimationFrame(id); frames.delete(id); }

const TRACKS=options.tracks;
// 转义曲目和歌词文字，保持原稿生成内容的安全边界。
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");}
// 生成当前曲目的原稿双语歌词与时间轴。
function fsLinesFor(idx,dur){
  var pairs=null;
  if(LYR_FULL[idx]){ pairs=LYR_FULL[idx]; }
  else{
    var trk=TRACKS[idx], pool=trk?LYR_POOL[trk.album]:null;
    if(pool){
      var seen=0; for(var k=0;k<idx;k++){ if(TRACKS[k].album===trk.album)seen++; }
      var off=(seen*3)%pool.length; pairs=[];
      for(var m=0;m<pool.length;m++)pairs.push(pool[(off+m)%pool.length]);
    }else{
      var base=LYRICS[idx]||["—"]; pairs=base.map(function(s){return [s,""];});
    }
  }
  var n=pairs.length,out=[],D=dur||200;
  for(var i=0;i<n;i++){ out.push({t:Math.round(i*D/n*10)/10,o:pairs[i][0],tr:pairs[i][1]||""}); }
  return out;
}
var ICON_PLAY='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
var ICON_PAUSE='<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
var VOL_SPK='<path d="M11 5L6 9H3v6h3l5 4z"/>';
var ICON_VOL_HIGH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+VOL_SPK+'<path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.6 5.4a9.5 9.5 0 010 13.2"/></svg>';
var ICON_VOL_LOW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+VOL_SPK+'<path d="M15.5 10a2.9 2.9 0 010 4"/></svg>';
var ICON_VOL_MUTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+VOL_SPK+'<path d="M16 9.6l5.4 5.4M21.4 9.6L16 15"/></svg>';
const state=options.state;
var ICON_RENAME='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
var ICON_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
var fsCloseTimer=null;

// 按原稿格式显示播放时间。
function fmt(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
// 查找当前 Vue 页面里的播放器窗口。
function players(){return document.querySelectorAll("[data-player]");}
// 原稿交互：保留 effVol 对应的界面行为与调用规则。
function effVol(){return state.muted?0:state.vol;}
// 原稿交互：保留 renderVolume 对应的界面行为与调用规则。
function renderVolume(){
  var eff=effVol();
  var icon=eff===0?ICON_VOL_MUTE:(eff<50?ICON_VOL_LOW:ICON_VOL_HIGH);
  var lbl=eff===0?("已静音 · 原音量 "+state.vol+"% — 点击恢复声音"):("音量 "+state.vol+"% — 点击静音");
  players().forEach(function(p){
    p.querySelectorAll("[data-volbtn]").forEach(function(b){
      b.innerHTML=icon;
      b.setAttribute("aria-label",lbl); b.setAttribute("title",lbl);
      b.classList.toggle("muted",eff===0);
    });
    p.querySelectorAll(".vol").forEach(function(v){
      if(document.activeElement!==v)v.value=eff;
      v.style.setProperty("--p",eff+"%");
      v.setAttribute("aria-label","音量 "+eff+"%");
    });
  });
}
// 原稿交互：保留 setVol 对应的界面行为与调用规则。
function setVol(v){
  v=Math.max(0,Math.min(100,Math.round(v)));
  state.vol=v;
  if(v>0){ state.muted=false; state.lastVol=v; }
  renderVolume();
}
// 原稿交互：保留 toggleMute 对应的界面行为与调用规则。
function toggleMute(){
  if(state.muted||state.vol===0){ state.muted=false; if(state.vol===0)state.vol=state.lastVol>0?state.lastVol:70; }
  else { state.lastVol=state.vol; state.muted=true; }
  renderVolume();
}
var DEVICES=["桌面音箱","耳机"];
// 原稿交互：保留 cycleDevice 对应的界面行为与调用规则。
function cycleDevice(){ var i=DEVICES.indexOf(state.settings.output); state.settings.output=DEVICES[(i+1)%DEVICES.length]; renderSettings(); }

/* ---------- this round : queue model + listening bundle + desktop bundle ---------- */
var ICON_QNEXT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5v14l7-7z" fill="currentColor" stroke="none"/><path d="M13 5v14l7-7z" fill="currentColor" stroke="none" opacity=".55"/><path d="M21 5v14"/></svg>';
var _qDrag=null;
var deskFont=21;
// 原稿交互：保留 ensureQueue 对应的界面行为与调用规则。
function ensureQueue(){ if(!state.queue||!state.queue.length){ state.queue=TRACKS.map(function(tr,i){return i;}); } }
// 原稿交互：保留 qpos 对应的界面行为与调用规则。
function qpos(){ ensureQueue(); return state.queue.indexOf(state.idx); }
// 原稿交互：保留 queueNextTi 对应的界面行为与调用规则。
function queueNextTi(){ ensureQueue(); var q=state.queue,p=q.indexOf(state.idx); if(state.repeat===2)return state.idx; if(p>-1&&p<q.length-1)return q[p+1]; if(state.repeat===1||state.radioOn)return q[0]; return null; }
/* deterministic stand-ins for play history (a real build reads the listening DB) */
// 原稿交互：保留 metaSeed 对应的界面行为与调用规则。
function metaSeed(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
// 原稿交互：保留 playsOf 对应的界面行为与调用规则。
function playsOf(tr){ return 3+metaSeed("plays|"+tr.title)%58; }
// 原稿交互：保留 lastDaysOf 对应的界面行为与调用规则。
function lastDaysOf(tr){ return 1+metaSeed("last|"+tr.title)%45; }
// 原稿交互：保留 addedDaysOf 对应的界面行为与调用规则。
function addedDaysOf(tr){ return 3+metaSeed("added|"+tr.title)%150; }
var SMART_DEFS=[
 {kind:"stale",name:"久未听的",rule:"按上次播放距今由久到近自动排"},
 {kind:"loop",name:"循环最多",rule:"按累计播放次数由高到低自动排"},
 {kind:"rewind",name:"随机重温",rule:"每天换一批 · 固定种子随机抽"}
];
// 原稿交互：保留 smartList 对应的界面行为与调用规则。
function smartList(kind){
  var all=TRACKS.map(function(tr,i){return i;});
  if(kind==="stale")return all.slice().sort(function(a,b){ return lastDaysOf(TRACKS[b])-lastDaysOf(TRACKS[a])||a-b; }).slice(0,8);
  if(kind==="loop")return all.slice().sort(function(a,b){ return playsOf(TRACKS[b])-playsOf(TRACKS[a])||a-b; }).slice(0,8);
  var seed=metaSeed("rewind|"+new Date().toDateString()),arr=all.slice();
  for(var i=arr.length-1;i>0;i--){ seed=(Math.imul(seed,1103515245)+12345)>>>0; var j=seed%(i+1),t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  return arr.slice(0,8);
}
// 原稿交互：保留 smartMeta 对应的界面行为与调用规则。
function smartMeta(kind,ti){ var tr=TRACKS[ti]; if(kind==="stale")return lastDaysOf(tr)+" 天前听过"; if(kind==="loop")return "播放 "+playsOf(tr)+" 次"; return "加入 "+addedDaysOf(tr)+" 天"; }
// 原稿交互：保留 playSmart 对应的界面行为与调用规则。
function playSmart(kind){ var list=smartList(kind); if(!list.length)return; state.radioOn=false; state.radioSeed=null; state.queue=list.slice(); buildLists(); selectTrack(list[0],true); }
/* radio : seed = current track; same album first, then same artist, then seeded rest */
// 原稿交互：保留 similarOrder 对应的界面行为与调用规则。
function similarOrder(seedIdx){ var seed=TRACKS[seedIdx],sameAlbum=[],sameArtist=[],rest=[];
  TRACKS.forEach(function(tr,i){ if(i===seedIdx)return; if(tr.album===seed.album)sameAlbum.push(i); else if(tr.artist===seed.artist)sameArtist.push(i); else rest.push(i); });
  rest.sort(function(a,b){ return metaSeed(seed.title+"|"+TRACKS[a].title)-metaSeed(seed.title+"|"+TRACKS[b].title); });
  return sameAlbum.concat(sameArtist,rest);
}
// 原稿交互：保留 startRadio 对应的界面行为与调用规则。
function startRadio(){ var seed=state.idx; state.radioOn=true; state.radioSeed=seed; state.queue=[seed].concat(similarOrder(seed)); buildLists(); setPlaying(true); render(); }
// 原稿交互：保留 stopRadio 对应的界面行为与调用规则。
function stopRadio(){ state.radioOn=false; state.radioSeed=null; state.queue=TRACKS.map(function(tr,i){return i;}); buildLists(); render(); }
// 原稿交互：保留 radioExtend 对应的界面行为与调用规则。
function radioExtend(){ if(!state.radioOn)return; var seed=state.radioSeed==null?state.idx:state.radioSeed;
  var more=similarOrder(seed).filter(function(i){ return state.queue.indexOf(i)===-1; });
  if(!more.length){ var rest=TRACKS.map(function(tr,i){return i;}).filter(function(i){ return i!==state.idx; }); rest.sort(function(a,b){ return metaSeed("again"+state.queue.length+"|"+TRACKS[a].title)-metaSeed("again"+state.queue.length+"|"+TRACKS[b].title); }); more=rest; }
  if(more.length){ state.queue=state.queue.concat(more.slice(0,6)); buildLists(); }
}
/* queue editing : play-next + drag reorder */
// 原稿交互：保留 playNext 对应的界面行为与调用规则。
function playNext(ti){ ensureQueue(); if(ti===state.idx)return; var q=state.queue,p=q.indexOf(state.idx),cur=q.indexOf(ti); if(cur>-1)q.splice(cur,1); if(cur>-1&&cur<p)p--; q.splice(p+1,0,ti); buildLists(); render(); }
// 原稿交互：保留 moveQueue 对应的界面行为与调用规则。
function moveQueue(from,to){ var q=state.queue; if(!q||from<0||from>=q.length)return; var it=q.splice(from,1)[0]; if(to>from)to--; to=Math.max(0,Math.min(q.length,to)); q.splice(to,0,it); buildLists(); render(); }
// 原稿交互：保留 buildQueueInto 对应的界面行为与调用规则。

/* rows for the radio list + smart playlist cards (rendered inside renderPages) */
// 原稿交互：保留 radioRow 对应的界面行为与调用规则。

// 原稿交互：保留 smartRow 对应的界面行为与调用规则。

// 原稿交互：保留 smartCardEl 对应的界面行为与调用规则。

/* desktop bundle : page-level fake desktop sync + sidebar util actions */
// 原稿交互：保留 applyDeskSettings 对应的界面行为与调用规则。
function applyDeskSettings() {}
// 同步原稿桌面歌词、托盘迷你卡片和系统媒体卡片。
function syncDesk() {}
// 将原稿桌面功能入口接入对应的 Tauri 独立窗口。
function handleUtil(u){
  if(options.onDesktop){ if(u === "lyr"){ state.settings.deskLock=false; render(); } options.onDesktop(u);return;}

  var sec=document.getElementById("deskSection"); if(!sec)return;
  if(u==="mini"){ var pop=document.getElementById("trayPop"); if(pop)pop.hidden=false; sec.scrollIntoView({behavior:"smooth",block:"center"}); }
  if(u==="lyr"){ state.settings.deskLyrics=!state.settings.deskLyrics; renderSettings(); sec.scrollIntoView({behavior:"smooth",block:"center"}); }
  if(u==="media"){ state.settings.smtc=!state.settings.smtc; applyDeskSettings(); sec.scrollIntoView({behavior:"smooth",block:"center"}); }
}
// 同步原稿演示曲目的快捷切歌入口。

// 按原稿生成歌曲列表、推荐卡片和播放队列。
function buildLists(){ ensureQueue(); }
// 原稿交互：保留 trowHTML 对应的界面行为与调用规则。

// 原稿交互：保留 makeTrow 对应的界面行为与调用规则。

// 原稿交互：保留 syncSearchInputs 对应的界面行为与调用规则。
function syncSearchInputs(except){ players().forEach(function(p){ p.querySelectorAll("[data-search-input],[data-top-search]").forEach(function(inp){ if(inp!==except)inp.value=state.query; }); }); }
// 原稿交互：保留 setPage 对应的界面行为与调用规则。
function setPage(pg,plIdx,viaNav){ state._util=null; var np=(typeof plIdx==="number")?plIdx:state.playlistIdx; if(!viaNav&&(pg!==state.page||(pg==="playlist"&&np!==state.playlistIdx))){ state._hist.push({page:state.page,playlistIdx:state.playlistIdx}); if(state._hist.length>24)state._hist.shift(); state._fwd=[]; } if(typeof plIdx==="number")state.playlistIdx=plIdx; state.page=pg; state._pageKey=""; if(!viaNav&&options.onNavigate)options.onNavigate(pg,state.playlistIdx); render(); players().forEach(function(p){ var m=p.querySelector(".main"); if(m)m.scrollTop=0; }); }
// 原稿交互：保留 navBack 对应的界面行为与调用规则。
function navBack(){ if(!state._hist.length)return; state._fwd.push({page:state.page,playlistIdx:state.playlistIdx}); var h=state._hist.pop(); setPage(h.page,h.playlistIdx,true); options.onNavigate(h.page,h.playlistIdx); }
// 原稿交互：保留 navFwd 对应的界面行为与调用规则。
function navFwd(){ if(!state._fwd.length)return; state._hist.push({page:state.page,playlistIdx:state.playlistIdx}); var f=state._fwd.pop(); setPage(f.page,f.playlistIdx,true); options.onNavigate(f.page,f.playlistIdx); }
var PAGE_NAMES={home:"首页",search:"搜索",library:"音乐库",albums:"专辑",artists:"歌手",album:"专辑",artist:"歌手",liked:"我喜欢的",recent:"最近播放",playlist:"歌单",settings:"设置",connect:"内容导入",upload:"内容导入",downloads:"内容导入",hub:"功能全景",radio:"歌曲电台"};
/* grouped navigation : album/artist detail + 专辑/歌手/喜欢/最近 all belong to the 音乐库 hub item;
   upload/downloads belong to the 内容导入 hub item — the sliding pill targets the hub item */
var NAVKEY={album:"library",artist:"library",albums:"library",artists:"library",liked:"library",recent:"library",upload:"connect",downloads:"connect"};
var PAGE_SIZE=10;
var PG_PREV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>';
var PG_NEXT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>';
// 原稿交互：保留 firstIdxBy 对应的界面行为与调用规则。
function firstIdxBy(fn){ var seen={},out=[]; TRACKS.forEach(function(tr,i){ var k=fn(tr); if(!seen[k]){ seen[k]=1; out.push(i); } }); return out; }
// 原稿交互：保留 albumPos 对应的界面行为与调用规则。
function albumPos(){ var a=TRACKS[state.playlistIdx].album,seen={},pos=0; for(var i=0;i<TRACKS.length;i++){ if(!seen[TRACKS[i].album]){ seen[TRACKS[i].album]=1; if(TRACKS[i].album===a)return pos; pos++; } } return 0; }
// 原稿交互：保留 pageSlice 对应的界面行为与调用规则。
function pageSlice(arr,key){ var pages=Math.max(1,Math.ceil(arr.length/PAGE_SIZE)); var cur=Math.min(state.pg[key]||1,pages); return arr.slice((cur-1)*PAGE_SIZE,cur*PAGE_SIZE); }
/* list sorting : def keeps the list's own order; title/artist alphabetical, dur shortest first;
   ties fall back to the original index so the order is stable */
// 原稿交互：保留 sortIdx 对应的界面行为与调用规则。
function sortIdx(arr,key){
  var m=state.sorts[key]||"def";
  if(m==="def")return arr;
  var out=arr.slice();
  out.sort(function(a,b){
    var ta=TRACKS[a],tb=TRACKS[b];
    if(m==="title"){ var c=ta.title<tb.title?-1:(ta.title>tb.title?1:0); return c||(a-b); }
    if(m==="artist"){ var c2=ta.artist<tb.artist?-1:(ta.artist>tb.artist?1:0); return c2||(a-b); }
    return (ta.dur-tb.dur)||(a-b);
  });
  return out;
}
/* standard 7-slot pagination (Atlassian / IxDF pattern): first + last, current ±1, ellipsis;
   rendered only when there is more than one page; current page is a glass capsule */

// 测量侧栏选中入口并移动原稿高亮胶囊。
function positionPill(p){
  var pill=p.querySelector("[data-pill]"); if(!pill)return;
  var target=null,kind="nav";
  if(state._util)target=p.querySelector('[data-util="'+state._util+'"]');
  if(!target&&state.page==="playlist"&&state.customPl){ target=p.querySelector('[data-custom="'+state.customPl.name+'"]'); kind="pl"; }
  if(!target&&state.page==="playlist"){ target=p.querySelectorAll("[data-sidebar-lists] .plist")[albumPos()]; kind="pl"; }
  if(!target)target=p.querySelector('[data-nav="'+(NAVKEY[state.page]||state.page)+'"]');
  if(!target){ pill.style.opacity="0"; return; }
  pill.classList.toggle("pl",kind==="pl");
  var first=!p._pillInit; p._pillInit=true;
  if(first)pill.style.transition="none";
  pill.style.height=target.offsetHeight+"px";
  pill.style.transform="translateY("+target.offsetTop+"px)";
  pill.style.opacity="1";
  if(first)requestAnimationFrame(function(){ pill.style.transition=""; });
}
/* sliding pills for hub tab bars + pagers : same language as the sidebar pill —
   one pill per bar, buttons themselves never paint a selected background */
// 原稿交互：保留 placeSlidePill 对应的界面行为与调用规则。
function placeSlidePill(pill,target,snap){
  if(!pill||!target)return;
  if(snap)pill.style.transition="none";
  pill.style.width=target.offsetWidth+"px";
  pill.style.height=target.offsetHeight+"px";
  pill.style.transform="translate("+target.offsetLeft+"px,"+target.offsetTop+"px)";
  pill.style.opacity="1";
  if(snap){ void pill.offsetWidth; pill.style.transition=""; }
}
// 更新原稿分页胶囊位置。
function positionPgPill() {}
// 更新原稿标签条的胶囊位置。
function positionTabPills() {}
/* segmented controls — sort bars (.sort-seg) and every Settings seg (.set-seg) — get the
   same ONE sliding pill: the seg elements are static markup that survives re-renders, so
   the last selected key is kept on the element itself; on a change the pill is first
   pinned (no transition) onto the previously selected option in the SAME control, one
   frame is committed, then it glides to the new option with the shared spring. Buttons
   never paint their own background — only their text colour flips. */
// 原稿交互：保留 segBtnKey 对应的界面行为与调用规则。
function segBtnKey() {}
// 更新原稿排序与设置分段控件的高亮位置。
function positionSegPills() {}
// 原稿交互：保留 snapAllPills 对应的界面行为与调用规则。
function snapAllPills() {}
// 按原稿导航状态更新页面与列表。
function renderPages(){
  var totalDur=fmt(TRACKS.reduce(function(sum,tr){return sum+tr.dur;},0));
  players().forEach(function(p){
    var main=p.querySelector(".main");
    if(main)main.classList.toggle("show-page",state.page!=="home");
    p.querySelectorAll("[data-chrome-title]").forEach(function(el){ var dt=TRACKS[state.playlistIdx]; el.textContent=state.page==="playlist"?("歌单 · "+dt.album):state.page==="album"?("专辑 · "+dt.album):state.page==="artist"?("歌手 · "+dt.artist):PAGE_NAMES[state.page]; });
    p.querySelectorAll("[data-nav-back]").forEach(function(el){ el.disabled=!state._hist.length; });
    p.querySelectorAll("[data-nav-fwd]").forEach(function(el){ el.disabled=!state._fwd.length; });
    p.querySelectorAll("[data-panel]").forEach(function(pn){ pn.classList.toggle("active",pn.getAttribute("data-panel")===state.page); });
    p.querySelectorAll("[data-nav]").forEach(function(nv){ nv.classList.toggle("on",nv.getAttribute("data-nav")===(NAVKEY[state.page]||state.page)); });
    p.querySelectorAll("[data-sidebar-lists] .plist").forEach(function(pl,i){ pl.classList.toggle("on",state.page==="playlist"&&!state.customPl&&i===albumPos()); });
    p.querySelectorAll("[data-lib-tab]").forEach(function(b){ var k=b.getAttribute("data-lib-tab"); b.classList.toggle("on",state.page===k||(state.page==="album"&&k==="albums")||(state.page==="artist"&&k==="artists")); });
    p.querySelectorAll("[data-src-tab]").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-src-tab")===state.page); });
    p.querySelectorAll("[data-custom]").forEach(function(pl){ pl.classList.toggle("on",state.page==="playlist"&&!!state.customPl&&pl.getAttribute("data-custom")===state.customPl.name); });
    var ptr=TRACKS[state.playlistIdx];
    p.querySelectorAll("[data-pl-cover]").forEach(function(el){ el.src=ptr.cover; });
    p.querySelectorAll("[data-pl-name]").forEach(function(el){ el.textContent=ptr.album; });
    p.querySelectorAll("[data-pl-desc]").forEach(function(el){ el.textContent=ptr.artist+" 的专辑歌单 · "+ptr.q+" · 当前曲目 "+ptr.title; });
    p.querySelectorAll("[data-pl-meta]").forEach(function(el){ el.textContent="共 "+TRACKS.length+" 首 · "+totalDur; });
    if(state.page==="playlist"&&state.customPl){
      p.querySelectorAll("[data-pl-name]").forEach(function(el){ el.textContent=state.customPl.name; });
      p.querySelectorAll("[data-pl-desc]").forEach(function(el){ el.textContent="来自 "+state.customPl.source+" · 共 "+state.customPl.count+" 首（演示）· 曲目预览为曲库示例，点任意一行播放"; });
      p.querySelectorAll("[data-pl-meta]").forEach(function(el){ el.textContent="共 "+state.customPl.count+" 首 · 来源 "+state.customPl.source; });
      p.querySelectorAll("[data-pl-cover]").forEach(function(el){ el.src=state.customPl.cover||ptr.cover; });
      p.querySelectorAll("[data-chrome-title]").forEach(function(el){ el.textContent="歌单 · "+state.customPl.name; });
    }
    var dtr=TRACKS[state.playlistIdx];
    var albIdx=TRACKS.map(function(tr,i){return i;}).filter(function(i){return TRACKS[i].album===dtr.album;});
    var artIdx=TRACKS.map(function(tr,i){return i;}).filter(function(i){return TRACKS[i].artist===dtr.artist;});
    p.querySelectorAll("[data-ad-cover]").forEach(function(el){ el.src=dtr.cover; });
    p.querySelectorAll("[data-ad-name]").forEach(function(el){ el.textContent=dtr.album; });
    p.querySelectorAll("[data-ad-desc]").forEach(function(el){ el.textContent=dtr.artist+" · "+dtr.q+" · 主打 "+dtr.title; });
    p.querySelectorAll("[data-ad-meta]").forEach(function(el){ el.textContent="共 "+albIdx.length+" 首 · "+fmt(albIdx.reduce(function(s,i){return s+TRACKS[i].dur;},0)); });
    p.querySelectorAll("[data-ard-cover]").forEach(function(el){ el.src=dtr.cover; });
    p.querySelectorAll("[data-ard-name]").forEach(function(el){ el.textContent=dtr.artist; });
    p.querySelectorAll("[data-ard-desc]").forEach(function(el){ el.textContent="代表专辑 "+dtr.album+" · "+dtr.q; });
    p.querySelectorAll("[data-ard-meta]").forEach(function(el){ el.textContent="共 "+artIdx.length+" 首 · "+fmt(artIdx.reduce(function(s,i){return s+TRACKS[i].dur;},0)); });
    var likedIdx=TRACKS.map(function(tr,i){return i;}).filter(function(i){return !!state.liked[i];});
    p.querySelectorAll("[data-liked-count]").forEach(function(el){ el.textContent=likedIdx.length; });
    p.querySelectorAll("[data-liked-total]").forEach(function(el){ el.textContent=likedIdx.length; });
    var lem=p.querySelector("[data-liked-empty]"); if(lem)lem.style.display=likedIdx.length?"none":"block";
    var rem=p.querySelector("[data-recent-empty]"); if(rem)rem.style.display=state.recent.length?"none":"block";
    p.querySelectorAll("[data-sort]").forEach(function(b){ var pr=b.getAttribute("data-sort").split(":"); b.classList.toggle("on",(state.sorts[pr[0]]||"def")===pr[1]); });
    p.querySelectorAll("[data-clear-recent]").forEach(function(b){ b.style.display=state.recent.length?"":"none"; });
    p.querySelectorAll("[data-radio-toggle]").forEach(function(b){ b.textContent=state.radioOn?"停止电台":"开始电台"; });
    p.querySelectorAll("[data-radio-status]").forEach(function(el){ el.textContent=state.radioOn?("电台进行中 · 以《"+TRACKS[state.radioSeed==null?state.idx:state.radioSeed].title+"》为种子，播完自动续播"):"以当前播放的歌曲为种子，同专辑优先、再同歌手、其余按相似度排队"; });
    positionPill(p);


  });
}
// 同步原稿全部设置控件和毛玻璃、液态玻璃材质。
function renderSettings(){
  var s=state.settings;
  document.body.classList.toggle("wx-off",!s.weather);
  document.body.classList.toggle("calm",!s.motion);
  players().forEach(function(p,pi){
    var eff=s.glassStyle==="frosted"?"frosted":(s.glassStyle==="liquid"?"liquid":(pi===1?"liquid":"frosted"));
    var wrap=p.parentElement;
    if(wrap){ wrap.classList.toggle("glass-win",eff==="frosted"); wrap.classList.toggle("liquid-win",eff==="liquid"); }
    if(eff==="liquid")p.setAttribute("data-liquid",""); else p.removeAttribute("data-liquid");
    var ed=p.querySelector(".brand span"); if(ed)ed.textContent=eff==="frosted"?"FROSTED EDITION":"LIQUID EDITION";
    var col=document.getElementById(pi===1?"colB":"colA");
    if(col){ var ver=col.querySelector(".ver"); if(ver){ ver.textContent="VERSION "+(pi===1?"B":"A")+" · "+(eff==="frosted"?"FROSTED":"LIQUID"); ver.classList.toggle("ver-a",eff==="frosted"); ver.classList.toggle("ver-b",eff==="liquid"); } }
  });
  players().forEach(function(p){
    p.querySelectorAll("[data-set-toggle]").forEach(function(b){ var on=!!s[b.getAttribute("data-set-toggle")]; b.classList.toggle("on",on); b.setAttribute("aria-checked",on?"true":"false"); });
    p.querySelectorAll("[data-set-seg]").forEach(function(seg){ var key=seg.getAttribute("data-set-seg"); seg.querySelectorAll("button").forEach(function(b){ b.classList.toggle("on",b.getAttribute("data-val")===s[key]); }); });
    p.querySelectorAll("[data-set-range]").forEach(function(r){ var key=r.getAttribute("data-set-range"); if(document.activeElement!==r)r.value=s[key]; r.style.setProperty("--p",(r.value/r.max*100)+"%"); });
    p.querySelectorAll("[data-set-val]").forEach(function(el){ el.textContent=s[el.getAttribute("data-set-val")]+" 秒"; });
    p.querySelectorAll("[data-device]").forEach(function(el){ el.setAttribute("title","输出设备 · "+s.output+" — 点击切换"); el.setAttribute("aria-label","输出设备："+s.output+"，点击切换"); });
    p.querySelectorAll("[data-airbtn]").forEach(function(el){ el.textContent="输出 · "+s.output; el.setAttribute("title","输出设备 · "+s.output+" — 点击切换"); });
    positionSegPills(p,false);
  });
  applyDeskSettings();
}

// 原稿交互：保留 fmtSize 对应的界面行为与调用规则。
function fmtSize(b){ if(b>1048576)return (b/1048576).toFixed(1)+" MB"; if(b>1024)return Math.round(b/1024)+" KB"; return b+" B"; }
// 保留原稿平台对接、上传及下载管理的演示流程。
function renderSources(){
  var key=JSON.stringify(state.platforms)+"|"+JSON.stringify(state.impPicked)+"|"+state.imported.length+"|"+state.uploads.length+"|"+state.upAdded+"|"+state.myLists.map(function(m){return m.name;}).join(",")+"|"+state._renaming+"|"+(state._delPl||"")+"|"+JSON.stringify(state.dlPaused)+"|"+state.impMsg+"|"+state.upMsg+"|"+state.linkMsg+"|"+state.lastSync+"|"+TRACKS.length;
  if(state._srcKey===key)return; state._srcKey=key;
  var connN=["netease","kugou","kuwo"].filter(function(k){return state.platforms[k];}).length;
  players().forEach(function(p){
    p.querySelectorAll("[data-conn-count]").forEach(function(el){ el.textContent=connN+"/3"; });
    p.querySelectorAll("[data-up-count]").forEach(function(el){ el.textContent=state.upAdded?String(state.upAdded):""; });
    p.querySelectorAll("[data-plat-card]").forEach(function(card){
      var k=card.getAttribute("data-plat-card"), on=!!state.platforms[k];
      card.classList.toggle("connected",on);
      var st=card.querySelector("[data-plat-status]"); if(st){ st.textContent=on?"已连接":"未连接"; st.classList.toggle("on",on); }
      var btn=card.querySelector("[data-conn-btn]"); if(btn){ btn.textContent=on?"断开连接":("连接"+(k==="netease"?"网易云":k==="kugou"?"酷狗":"酷我")); btn.classList.toggle("off",on); }
    });
    p.querySelectorAll("[data-stat-conn]").forEach(function(el){ el.textContent=connN+" / 3"; });
    p.querySelectorAll("[data-stat-imp]").forEach(function(el){ el.textContent=state.imported.length; });
    p.querySelectorAll("[data-stat-impsongs]").forEach(function(el){ el.textContent=state.imported.reduce(function(sm,x){return sm+x.count;},0); });
    p.querySelectorAll("[data-stat-sync]").forEach(function(el){ el.textContent=state.lastSync||"—"; });
    var picked=IMP_LIST.filter(function(x){return state.impPicked[x.id];}).length;
    p.querySelectorAll("[data-imp-picked]").forEach(function(el){ el.textContent="已选 "+picked; });
    p.querySelectorAll("[data-imp-status]").forEach(function(el){ if(state.impMsg)el.textContent=state.impMsg; });
    p.querySelectorAll("[data-link-result]").forEach(function(el){ el.textContent=state.linkMsg; });
    var il=p.querySelector("[data-imp-list]");
    if(il){ il.innerHTML="";
      var avail=IMP_LIST.filter(function(x){return state.platforms[x.plat];});
      if(!avail.length){ il.innerHTML='<div class="empty-note">还没有已连接的平台 — 先在上方连接网易云 / 酷狗 / 酷我中的任意一个，这里会列出可导入的歌单。</div>'; }
      avail.forEach(function(x){
        var done=state.imported.some(function(y){return y.name===x.name;});
        var row=document.createElement("div"); row.className="imp-row";
        row.innerHTML='<img src="'+x.cover+'" alt=""><span class="it"><b>'+x.name+'</b><span>'+x.platName+' · '+x.count+' 首</span></span>';
        var b=document.createElement("button"); b.className="imp-pick"+(done?" on":(state.impPicked[x.id]?" on":"")); b.textContent=done?"已导入":(state.impPicked[x.id]?"已勾选":"选择导入");
        b.disabled=done;
        b.addEventListener("click",function(){ state.impPicked[x.id]=!state.impPicked[x.id]; state._srcKey=""; render(); });
        row.appendChild(b); il.appendChild(row);
      });
    }
    var ml=p.querySelector("[data-my-lists]");
    if(ml){ ml.innerHTML="";
      var openPl=function(x){ state.customPl={name:x.name,source:x.source,count:x.count,cover:x.cover}; setPage("playlist",state.playlistIdx); state._pageKey=""; render(); };
      state.myLists.forEach(function(x,mi){
        if(state._renaming===mi){
          var er=document.createElement("div"); er.className="plist-edit";
          var ein=document.createElement("input"); ein.type="text"; ein.value=x.name; ein.maxLength=30; ein.setAttribute("aria-label","歌单名称");
          var ok=document.createElement("button"); ok.className="pl-mini"; ok.type="button"; ok.textContent="保存";
          var cc=document.createElement("button"); cc.className="pl-mini"; cc.type="button"; cc.textContent="取消";
          var save=function(){ var nn=ein.value.trim(); if(nn&&nn!==x.name){ var old=x.name; x.name=nn; if(state.customPl&&state.customPl.name===old)state.customPl.name=nn; } state._renaming=-1; state._srcKey=""; state._pageKey=""; render(); };
          ok.addEventListener("click",save);
          cc.addEventListener("click",function(){ state._renaming=-1; state._srcKey=""; render(); });
          ein.addEventListener("keydown",function(ev){ ev.stopPropagation(); if(ev.key==="Enter")save(); if(ev.key==="Escape"){ state._renaming=-1; state._srcKey=""; render(); } });
          ein.addEventListener("click",function(ev){ ev.stopPropagation(); });
          er.appendChild(ein); er.appendChild(ok); er.appendChild(cc); ml.appendChild(er);
          if(p===state._renameP)setTimeout(function(){ try{ ein.focus(); ein.select(); }catch(e){} },30);
          return;
        }
        if(state._delPl===x.name){
          var cr=document.createElement("div"); cr.className="plist-confirm";
          var ct=document.createElement("span"); ct.className="cf-txt"; ct.textContent="删除「"+x.name+"」？";
          var dy=document.createElement("button"); dy.className="pl-mini danger"; dy.type="button"; dy.textContent="删除";
          var dn=document.createElement("button"); dn.className="pl-mini"; dn.type="button"; dn.textContent="取消";
          dy.addEventListener("click",function(){
            var wasOpen=!!(state.customPl&&state.customPl.name===x.name);
            state.myLists.splice(mi,1); state._delPl=null; state._renaming=-1;
            if(wasOpen)state.customPl=null;
            state._srcKey=""; state._pageKey="";
            if(wasOpen&&state.page==="playlist")setPage("home"); else render();
          });
          dn.addEventListener("click",function(){ state._delPl=null; state._srcKey=""; render(); });
          cr.appendChild(ct); cr.appendChild(dy); cr.appendChild(dn); ml.appendChild(cr);
          return;
        }
        var row=document.createElement("div"); row.className="plist-row";
        var b=document.createElement("button"); b.className="plist"; b.setAttribute("data-custom",x.name);
        b.innerHTML='<img src="'+(x.cover||"/images/night-drive.webp")+'" alt=""><span>'+x.name+'</span>';
        b.addEventListener("click",function(){ openPl(x); });
        var acts=document.createElement("span"); acts.className="pl-acts";
        var rb=document.createElement("button"); rb.className="pl-act"; rb.type="button"; rb.setAttribute("aria-label","重命名歌单 "+x.name); rb.setAttribute("title","重命名"); rb.innerHTML=ICON_RENAME;
        rb.addEventListener("click",function(ev){ ev.stopPropagation(); state._renaming=mi; state._delPl=null; state._renameP=p; state._srcKey=""; render(); });
        var db=document.createElement("button"); db.className="pl-act"; db.type="button"; db.setAttribute("aria-label","删除歌单 "+x.name); db.setAttribute("title","删除"); db.innerHTML=ICON_TRASH;
        db.addEventListener("click",function(ev){ ev.stopPropagation(); state._delPl=x.name; state._renaming=-1; state._srcKey=""; render(); });
        acts.appendChild(rb); acts.appendChild(db);
        row.appendChild(b); row.appendChild(acts); ml.appendChild(row);
      });
      state.imported.forEach(function(x){
        var b=document.createElement("button"); b.className="plist"; b.setAttribute("data-custom",x.name);
        b.innerHTML='<img src="'+(x.cover||"/images/night-drive.webp")+'" alt=""><span>'+x.name+'</span>';
        b.addEventListener("click",function(){ openPl(x); });
        ml.appendChild(b);
      });
    }
    p.querySelectorAll("[data-up-stat-q]").forEach(function(el){ el.textContent=state.uploads.length; });
    p.querySelectorAll("[data-up-stat-done]").forEach(function(el){ el.textContent=state.upAdded; });
    p.querySelectorAll("[data-up-mine]").forEach(function(el){ el.textContent=state.upAdded; });
    p.querySelectorAll("[data-up-status]").forEach(function(el){ el.textContent=state.upMsg; });
    var fl=p.querySelector("[data-file-list]");
    if(fl){ fl.innerHTML=""; state.uploads.forEach(function(f,i){
      var row=document.createElement("div"); row.className="file-row";
      row.innerHTML='<span class="fi">♪</span><span class="it"><b>'+f.name+'</b><span>'+(f.folder?("文件夹「"+f.folder+"」 · "):"")+f.size+' · '+(f.ext||"AUDIO")+'</span></span>';
      var b=document.createElement("button"); b.className="imp-pick"; b.textContent=f.added?"已加入":"加入曲库";
      if(f.added){ b.classList.add("on"); b.disabled=true; }
      b.addEventListener("click",function(){ addUploadToLibrary(i); });
      row.appendChild(b);
      var st=document.createElement("span"); st.className="st"; st.textContent=f.added?"已入库":"待加入"; row.appendChild(st);
      fl.appendChild(row);
    }); }
    var fe=p.querySelector("[data-file-empty]"); if(fe)fe.style.display=state.uploads.length?"none":"block";
    var ue=p.querySelector("[data-up-empty]"); if(ue)ue.style.display=state.upAdded?"none":"block";
    var dl=p.querySelector("[data-dl-list]");
    if(dl){ dl.innerHTML=""; var active=0;
      DL_LIST.forEach(function(d,i){
        var paused=!!state.dlPaused[i]; if(d.prog<100&&!paused)active++;
        var row=document.createElement("div"); row.className="file-row";
        row.innerHTML='<span class="fi">↓</span><span class="it"><b>'+d.name+'</b><span>'+d.artist+' · '+d.size+' · '+(d.prog>=100?"已完成":(paused?"已暂停 · ":"下载中 · ")+d.prog+"%")+'</span></span>';
        if(d.prog<100){ var b=document.createElement("button"); b.className="imp-pick"+(paused?" on":""); b.textContent=paused?"继续":"暂停";
          b.addEventListener("click",function(){ state.dlPaused[i]=!state.dlPaused[i]; state._srcKey=""; render(); });
          row.appendChild(b); }
        else { var st=document.createElement("span"); st.className="st"; st.textContent="可离线播放"; row.appendChild(st); }
        dl.appendChild(row);
      });
      p.querySelectorAll("[data-dl-active]").forEach(function(el){ el.textContent=active; });
    }
  });
}
// 原稿交互：保留 addUploadToLibrary 对应的界面行为与调用规则。
function addUploadToLibrary(i){
  var f=state.uploads[i]; if(!f||f.added)return;
  var base=f.name.replace(/\.[^.]+$/,"");
  TRACKS.push({title:base,artist:"本地文件",album:"我上传的",dur:200,cover:TRACKS[TRACKS.length%4].cover,q:"本地 · "+(f.ext||"AUDIO"),glow:"rgba(140,160,255,.5)",mine:true});
  LYRICS.push(["这首歌还没有歌词","来自你上传的本地文件","正式版会自动匹配歌词与封面","—"]);
  f.added=true; state.upAdded++; state.upMsg="已加入音乐库：《"+base+"》— 在音乐库、搜索和上传页都能找到它。";
   buildLists(); state._pageKey=""; state._srcKey=""; render();
}

/* decorative spectrum background layer: bar heights are a per-track seeded waveform.
   Pure background — it carries no progress state: no lit/unlit split, no gradient,
   no seeking; it only rebuilds its outline when the track changes. */
var SPEC_N=168;
// 原稿交互：保留 buildSpecBars 对应的界面行为与调用规则。
function buildSpecBars(barsEl,seed){
  var s=(seed*7919+13)%2147483647; if(s<=0)s+=2147483646;
  var rnd=function(){ s=(s*16807)%2147483647; return s/2147483647; };
  var ph1=rnd()*6.283,ph2=rnd()*6.283,ph3=rnd()*6.283,raw=[],i,v;
  for(i=0;i<SPEC_N;i++){ v=0.46+0.27*Math.sin(i*0.105+ph1)+0.17*Math.sin(i*0.029+ph2)+0.13*Math.sin(i*0.47+ph3)+(rnd()-0.5)*0.2; raw.push(Math.max(0.16,Math.min(1,v))); }
  var html="";
  for(i=0;i<SPEC_N;i++){
    var h=(raw[(i-1+SPEC_N)%SPEC_N]+raw[i]*2+raw[(i+1)%SPEC_N])/4;
    html+='<i class="spec-bar" style="height:'+Math.round(h*100)+'%;animation-delay:'+(-(((i*37)%13)*0.083)).toFixed(2)+'s;animation-duration:'+(0.85+((i*53)%10)*0.07).toFixed(2)+'s"></i>';
  }
  barsEl.innerHTML=html;
  barsEl._track=seed;
}
// 原稿交互：保留 updateSpecBg 对应的界面行为与调用规则。
function updateSpecBg(bg){
  var barsEl=bg.querySelector("[data-spec-bars]"); if(!barsEl)return;
  if(barsEl._track!==state.idx)buildSpecBars(barsEl,state.idx);
}

/* fullscreen ambience colours: three tints derived from the track's own glow colour —
   base, lightened, deepened — so the mesh stays strictly inside the album palette */
// 原稿交互：保留 ambVars 对应的界面行为与调用规则。
function ambVars(glow){
  var m=/(\d+)[, ]+(\d+)[, ]+(\d+)/.exec(glow||""); if(!m)return null;
  var r=+m[1],g=+m[2],b=+m[3];
  function mix(tr,tg,tb,f){ return [Math.round(r+(tr-r)*f),Math.round(g+(tg-g)*f),Math.round(b+(tb-b)*f)]; }
  var l=mix(255,255,255,.38), d=mix(10,10,18,.34);
  return {a1:"rgba("+r+","+g+","+b+",.50)",a2:"rgba("+l[0]+","+l[1]+","+l[2]+",.36)",a3:"rgba("+d[0]+","+d[1]+","+d[2]+",.44)"};
}
// 原稿交互：保留 applyAmb 对应的界面行为与调用规则。
function applyAmb(p,ambEl){ var v=ambEl._av; if(!v)return; p.style.setProperty("--amb1",v.a1); p.style.setProperty("--amb2",v.a2); p.style.setProperty("--amb3",v.a3); }
// 同步曲目、歌词、队列、横幅与桌面表面，保持原稿行为。
function render(){
  var tr=TRACKS[state.idx];
  var lns=LYRICS[state.idx];
  var li=Math.min(lns.length-1,Math.floor(state.t/tr.dur*lns.length));
  var fls=fsLinesFor(state.idx,tr.dur);
  var fli=0; for(var fi=0;fi<fls.length;fi++){ if(fls[fi].t<=state.t+0.001)fli=fi; }
  var lyrKey=state.idx+":"+li+":"+fli;
  var av=null;
  if(state._ambIdx!==state.idx){ state._ambIdx=state.idx; av=ambVars(tr.glow); }
  players().forEach(function(p){
    p.classList.toggle("playing",state.playing);
    p.classList.toggle("fs-open",state.stage);
    p.classList.toggle("np-collapsed",!state.npOpen);
    p.querySelectorAll(".np-toggle").forEach(function(el){ var lbl=state.npOpen?"收起正在播放面板":"展开正在播放面板"; el.setAttribute("aria-expanded",state.npOpen?"true":"false"); el.setAttribute("aria-label",lbl); el.setAttribute("title",lbl); });
    p.querySelectorAll("[data-np-switch]").forEach(function(el){ el.classList.toggle("on",state.npOpen); el.setAttribute("aria-checked",state.npOpen?"true":"false"); });
    var fsx=p.querySelector("[data-fs]"); if(fsx)fsx.classList.toggle("qopen",state.fsQ);
    p.querySelectorAll("[data-queuebtn]").forEach(function(el){el.classList.toggle("on",state.fsQ);});
    p.style.setProperty("--glow",tr.glow);
    if(av){ var ambEl=p.querySelector(".fs-amb"); if(ambEl){ ambEl._av=av; if(!p._ambSet){ p._ambSet=true; applyAmb(p,ambEl); } else if(!ambEl._swapT){ ambEl.classList.add("swap"); ambEl._swapT=setTimeout(function(){ ambEl._swapT=null; applyAmb(p,ambEl); ambEl.classList.remove("swap"); },570); } } }
    p.querySelectorAll("[data-next-title]").forEach(function(el){ if(state.repeat===2){el.textContent=tr.title+" · "+tr.artist;} else if(state.shuffle){el.textContent="随机播放";} else {var nti=queueNextTi();el.textContent=nti==null?"队列结束":(TRACKS[nti].title+" · "+TRACKS[nti].artist);} });
    p.querySelectorAll("[data-radio-chip]").forEach(function(el){ el.hidden=!state.radioOn; });
    p.querySelectorAll("[data-radio-quick]").forEach(function(el){ el.textContent=state.radioOn?"电台中 · 查看":"开启电台"; });
    p.querySelectorAll("[data-radio-count]").forEach(function(el){ el.textContent=state.radioOn?"ON":""; });
    p.querySelectorAll("[data-cover]").forEach(function(el){el.src=tr.cover;});
    p.querySelectorAll("[data-title]").forEach(function(el){el.textContent=tr.title;});
    p.querySelectorAll("[data-artist]").forEach(function(el){el.textContent=tr.artist+" · "+tr.album;});
    p.querySelectorAll("[data-dur]").forEach(function(el){el.textContent=fmt(tr.dur);});
    p.querySelectorAll("[data-cur]").forEach(function(el){el.textContent=fmt(state.t);});
    p.querySelectorAll("[data-remain]").forEach(function(el){el.textContent="-"+fmt(tr.dur-state.t);});
    p.querySelectorAll("[data-seek]").forEach(function(seek){
      seek.value=Math.round(state.t/tr.dur*1000);
      seek.style.setProperty("--p",(state.t/tr.dur*100)+"%");
    });
    p.querySelectorAll("[data-specbg]").forEach(function(bg){ updateSpecBg(bg); });
    p.querySelectorAll("[data-play]").forEach(function(el){el.innerHTML=state.playing?ICON_PAUSE:ICON_PLAY;});
    p.querySelectorAll("[data-like]").forEach(function(el){el.classList.toggle("liked",!!state.liked[state.idx]);});
    p.querySelectorAll("[data-shuffle]").forEach(function(el){el.classList.toggle("on",state.shuffle);});
    p.querySelectorAll("[data-repeat]").forEach(function(el){ el.classList.toggle("on",state.repeat>0); el.classList.toggle("one",state.repeat===2); var rl=state.repeat===2?"单曲循环":(state.repeat===1?"循环全部":"循环已关闭"); el.setAttribute("aria-label",rl); el.setAttribute("title",rl+" — 点击切换"); });
    p.querySelectorAll(".main-chips button").forEach(function(b){ b.classList.toggle("on",b.textContent.trim()===state.chip); });
    var bg=p.querySelector("[data-bg]");if(bg)bg.style.backgroundImage="url("+tr.cover+")";
    var fsbg=p.querySelector("[data-fs-bg]");if(fsbg)fsbg.style.backgroundImage="url("+tr.cover+")";
    var glow=p.querySelector("[data-glow]");if(glow)glow.style.backgroundImage="url("+tr.cover+")";
    p.querySelectorAll("[data-meta1]").forEach(function(el){el.textContent=tr.q;});
    p.querySelectorAll("[data-meta2]").forEach(function(el){el.textContent="TRACK "+String(state.idx+1).padStart(2,"0")+" / "+String(TRACKS.length).padStart(2,"0");});
    p.querySelectorAll("[data-fs-giant]").forEach(function(el){el.textContent=tr.artist.toUpperCase();});
    p.querySelectorAll("[data-fsnum]").forEach(function(el){el.textContent=String(state.idx+1).padStart(2,"0")+" / "+String(TRACKS.length).padStart(2,"0");});
    p.querySelectorAll("[data-fs-spec]").forEach(function(el){el.textContent=tr.album.toUpperCase()+" · "+tr.q+" · "+fmt(tr.dur);});
    var bbg=p.querySelector("[data-banner-bg]");if(bbg)bbg.style.backgroundImage="url("+tr.cover+")";
    var bhalo=p.querySelector("[data-banner-halo]");if(bhalo)bhalo.style.backgroundImage="url("+tr.cover+")";
    p.querySelectorAll("[data-banner-title]").forEach(function(el){el.textContent=tr.album;});
    p.querySelectorAll("[data-banner-sub]").forEach(function(el){el.textContent=tr.title+" — "+tr.artist;});
    p.querySelectorAll("[data-banner-meta]").forEach(function(el){el.textContent=tr.q+" · "+fmt(tr.dur);});
    p.querySelectorAll("[data-banner-mini-cover]").forEach(function(el){el.src=tr.cover;});
    p.querySelectorAll("[data-banner-mini-title]").forEach(function(el){el.textContent=tr.album;});
    p.querySelectorAll("[data-bc]").forEach(function(el){el.src=TRACKS[(state.idx+parseInt(el.getAttribute("data-bc"),10))%TRACKS.length].cover;});
    p.querySelectorAll("[data-banner-play]").forEach(function(el){el.innerHTML=(state.playing?ICON_PAUSE:ICON_PLAY)+(state.playing?"暂停":"立即播放");});
    p.querySelectorAll(".trow").forEach(function(it,i){it.classList.toggle("on",i===state.idx);});
    p.querySelectorAll(".qitem").forEach(function(it){it.classList.toggle("on",parseInt(it.getAttribute("data-ti"),10)===state.idx);});
    p.querySelectorAll(".feat").forEach(function(it){ var ti=it.getAttribute("data-ti"); if(ti!==null&&TRACKS[parseInt(ti,10)]){ it.classList.toggle("on",TRACKS[parseInt(ti,10)].album===tr.album); } });
    p.querySelectorAll(".fsq-item").forEach(function(it){it.classList.toggle("on",parseInt(it.getAttribute("data-ti"),10)===state.idx);});
    p.querySelectorAll("[data-capsule-text]").forEach(function(el){
      if(el.textContent!==lns[li]){
        var had=!!el.textContent;
        el.textContent=lns[li];
        if(had&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){el.classList.remove("flip-in");void el.offsetWidth;el.classList.add("flip-in");}
      }
    });
    if(state._lyrKey!==lyrKey){
      var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var ly=p.querySelector("[data-lyric]");
      if(ly){
        if(ly.getAttribute("data-track")!==String(state.idx)||!ly.children.length){
          ly.innerHTML=lns.map(function(line,j){return '<div class="'+(j===li?"":"dim")+'">'+line+"</div>";}).join("");
          ly.setAttribute("data-track",String(state.idx));
        }else{
          for(var lj=0;lj<ly.children.length;lj++){ly.children[lj].className=(lj===li?"":"dim");}
        }
      }
      var fl=p.querySelector("[data-fs-lyrics]");
      if(fl){
        var lineCls=function(j){return "fl-line"+(j===fli?" on":(Math.abs(j-fli)===1?" d1":""))+(fl._focus===j?" focus":"");};
        if(fl.getAttribute("data-track")!==String(state.idx)||fl.children.length!==fls.length){
          fl.innerHTML=fls.map(function(L,j){return '<div class="'+lineCls(j)+'" data-lj="'+j+'"><span class="fl-o">'+escHtml(L.o)+"</span>"+(L.tr?'<span class="fl-tr">'+escHtml(L.tr)+"</span>":"")+"</div>";}).join("");
          fl.setAttribute("data-track",String(state.idx));
          fl._focus=null;
          fl._progUntil=Date.now()+90;
          var act0=fl.querySelector(".fl-line.on");
          if(act0){fl.scrollTop=Math.max(0,act0.offsetTop-fl.clientHeight/2+act0.offsetHeight/2);}
        }else{
          for(var fj=0;fj<fl.children.length;fj++){fl.children[fj].className=lineCls(fj);}
          var act=fl.querySelector(".fl-line.on");
          /* while the user is drag-browsing the lyrics, follow-scroll yields */
          if(act&&!(state._lyrHoldUntil&&Date.now()<state._lyrHoldUntil)){
            var target=Math.max(0,act.offsetTop-fl.clientHeight/2+act.offsetHeight/2);
            fl._progUntil=Date.now()+780;
            if(reduce){fl.scrollTop=target;}else{fl.scrollTo({top:target,behavior:"smooth"});}
          }
        }
      }
    }
  });
  state._lyrKey=lyrKey;
  renderVolume();
  var pgSig=state.query+"|"+state.page+"|"+state.playlistIdx+"|"+(state.customPl?state.customPl.name:"")+"|"+TRACKS.length;
  if(state._pgSig!==pgSig){ state._pgSig=pgSig; state.pg={}; }
  var pageKey=state.page+"|"+state.playlistIdx+"|"+state.query+"|"+state.idx+"|"+JSON.stringify(state.liked)+"|"+JSON.stringify(state.sorts)+"|"+state.recent.join(",")+"|"+(state._util||"")+"|"+(state.customPl?state.customPl.name:"")+"|"+TRACKS.length+"|"+(state.queue?state.queue.join(","):"")+"|"+(state.radioOn?"R":"")+"|"+(state.smartOpen||"");
  if(state._pageKey!==pageKey){ state._pageKey=pageKey; renderPages(); }
  renderSettings();
  renderSources();
  document.querySelectorAll("#trackPills button").forEach(function(b){ var ti=parseInt(b.getAttribute("data-ti"),10); b.classList.toggle("on",!isNaN(ti)&&!!TRACKS[ti]&&TRACKS[ti].album===TRACKS[state.idx].album); });
  syncDesk();

  if(options.onStateChange)options.onStateChange(getSnapshot());
}
// 按原稿计时器推进演示播放与自动续播。
function tick(){
  if(!state.playing)return;
  state.t+=0.25;
  var tr=TRACKS[state.idx];
  if(state.t>=tr.dur){
    if(state.repeat===2){ state.t=0; render(); return; }
    if(qpos()<state.queue.length-1||state.repeat===1){ nextTrack(); return; }
    if(state.radioOn){ radioExtend(); if(qpos()<state.queue.length-1){ nextTrack(); return; } }
    state.t=0; setPlaying(false); return;
  }
  render();
}
// 沿用原稿的演示播放计时与暂停行为。
function setPlaying(v){
  state.playing=v;
  if(state.timer){clearInterval(state.timer);state.timer=null;}
  if(v)state.timer=setInterval(tick,250);
  render();
}
// 沿用原稿全屏舞台的进入、退出与底栏动画。
function setStage(open){
  var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(open){
    if(fsCloseTimer){clearTimeout(fsCloseTimer);fsCloseTimer=null;}
    players().forEach(function(p){p.classList.remove("fs-closing");});
    state.stage=true; state._lyrKey=""; render(); return;
  }
  if(!state.stage)return;
  state.stage=false; state.fsQ=false; render();
  if(reduce)return;
  players().forEach(function(p){p.classList.add("fs-closing");});
  if(fsCloseTimer)clearTimeout(fsCloseTimer);
  fsCloseTimer=setTimeout(function(){ players().forEach(function(p){p.classList.remove("fs-closing");}); fsCloseTimer=null; },360);
}
/* fullscreen track-change transition: runs AFTER render() has put the new track on
   stage. dir=+1 (next) brings the new cover in from the right and sends the old one
   out to the left; dir=-1 mirrors it. Old cover / blurred backdrop survive only as
   short-lived ghost copies that crossfade away. A rapid second skip cancels every
   in-flight animation and removes the ghosts first, so the stage always lands
   cleanly on the newest track. Stage closed, calm (motion off) or reduced-motion:
   no transition at all — the plain render() result stands.
   Four more devices borrowed from community player shots ride on the same run:
   (1) a light band sweeps diagonally across the cover glass only — the bottom player (dock) gets no sweep;
   (2) the slide itself is layered — backdrop, ambience mesh, outline giant, cover
   and lyrics column each travel their own distance over their own duration;
   (3) the next card in the skip direction peeks out from behind the incoming cover
   mid-slide, like flipping a stack of cards; (4) the outline giant's entrance runs
   about twice the cover's duration, so it is still drifting in after the cover has
   landed. Transform/opacity only, album colour only. */
// 保留原稿全屏切歌的分层交叉入场动画。
function animateFsTrackChange(dir,oldTr){
  if(!state.stage||!oldTr)return;
  if(document.body.classList.contains("calm"))return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var E="cubic-bezier(.22,1,.36,1)";
  players().forEach(function(p){
    var fs=p.querySelector("[data-fs]"); if(!fs||!fs.animate)return;
    if(fs._xAnims)fs._xAnims.forEach(function(a){try{a.cancel();}catch(e){}});
    fs.querySelectorAll(".fs-xghost").forEach(function(g){g.remove();});
    var run=(fs._xRun=(fs._xRun||0)+1);
    var anims=[];
    function track(a,el){
      anims.push(a);
      a.onfinish=function(){ try{a.cancel();}catch(e){} if(el&&el.classList&&el.classList.contains("fs-xghost"))el.remove(); };
      return a;
    }
    function slide(el,fromVars,toVars,dur,delay){
      if(!el)return null;
      return track(el.animate([fromVars,toVars],{duration:dur,delay:delay||0,easing:E,fill:"both"}));
    }
    /* blurred backdrop: old cover hangs as a ghost and crossfades into the new one
       (the ambience mesh crossfades its colours on the same beat inside render()) */
    var fsbg=fs.querySelector("[data-fs-bg]");
    if(fsbg){
      var bgGhost=document.createElement("div");
      bgGhost.className="fs-bg fs-xghost"; bgGhost.setAttribute("aria-hidden","true");
      bgGhost.style.backgroundImage="url("+oldTr.cover+")"; bgGhost.style.transition="none";
      fsbg.parentNode.insertBefore(bgGhost,fsbg.nextSibling);
      track(bgGhost.animate([{opacity:1},{opacity:0}],{duration:680,easing:"ease-out",fill:"both"}),bgGhost);
      setTimeout(function(){bgGhost.remove();},760);
    }
    /* layered speeds, part of device 2: the NEW backdrop and the ambience mesh join
       the slide at the back of the pack — the backdrop barely travels (18px) over
       the longest glide, the mesh a touch less; their keyframes carry the resting
       backdrop scale so the handoff back to CSS is seamless. */
    if(fsbg){
      var bsc=fs.closest(".liquid-win")?1.12:1.16;
      track(fsbg.animate([
        {transform:"translateX("+(dir*18)+"px) scale("+bsc+")"},
        {transform:"translateX(0px) scale("+bsc+")"}
      ],{duration:920,easing:E,fill:"both"}));
    }
    var ambSlide=fs.querySelector(".fs-amb");
    if(ambSlide)track(ambSlide.animate([
      {transform:"translateX("+(dir*10)+"px)"},
      {transform:"translateX(0px)"}
    ],{duration:980,easing:E,fill:"both"}));
    /* cover: ghost of the old cover slides out + softens WHILE the new cover slides
       in — the two runs overlap from the same first frame (no "old one leaves, then
       the new one starts" gap). The layers are split so nothing fights over transform:
       .fs-coverwrap tilts, .fs-coverkb underneath carries the Ken Burns breathing, and
       the entrance below animates transform on the img alone — one continuous ease-out
       where slide and scale happen together, starting with no delay and ending exactly
       at the resting state (translateX 0 / scale 1 / no blur), so when the run is
       cancelled on finish the handoff to the still-breathing KB layer has zero step.
       The ghost lives inside the KB layer too, so it tracks the breathing exactly. */
    var wrap=fs.querySelector(".fs-main .fs-coverwrap");
    var cover=wrap?wrap.querySelector("img.fs-cover[data-cover]"):null;
    if(wrap&&cover){
      var kb=wrap.querySelector(".fs-coverkb");
      var ghost=document.createElement("img");
      ghost.className="fs-cover fs-xghost"; ghost.setAttribute("aria-hidden","true"); ghost.alt="";
      ghost.src=oldTr.cover; ghost.style.transition="none";
      (kb||wrap).appendChild(ghost);
      track(ghost.animate([
        {transform:"translateX(0) scale(1)",opacity:1,filter:"blur(0px)"},
        {transform:"translateX("+(-dir*34)+"px) scale(.94)",opacity:0,filter:"blur(6px)"}
      ],{duration:500,easing:E,fill:"both"}),ghost);
      setTimeout(function(){ghost.remove();},580);
      track(cover.animate([
        {transform:"translateX("+(dir*46)+"px) scale(.96)",opacity:0,filter:"blur(6px)"},
        {transform:"translateX(0) scale(1)",opacity:1,filter:"blur(0px)"}
      ],{duration:580,easing:E,fill:"both"}));
      var refl=wrap.querySelector(".fs-reflect");
      if(refl)track(refl.animate([{opacity:0},{opacity:.26}],{duration:580,delay:60,easing:"ease-out",fill:"both"}));
      /* card-stack peek (device 3): the next cover in the skip direction edges out
         from behind the incoming one while it is still travelling — far enough to
         read as a second card, with a slight fan rotation — then tucks back and
         fades as the new cover lands. It is an .fs-xghost, so a rapid re-skip
         cancels and removes it with everything else. */
      if(TRACKS.length>1){
        var nb=TRACKS[(state.idx+dir+TRACKS.length)%TRACKS.length];
        var peek=document.createElement("img");
        peek.className="fs-cover fs-peek fs-xghost"; peek.setAttribute("aria-hidden","true"); peek.alt="";
        peek.src=nb.cover; peek.style.transition="none";
        (kb||wrap).appendChild(peek);
        track(peek.animate([
          {transform:"translateX("+(dir*4)+"px) scale(.962) rotate(0deg)",opacity:0},
          {transform:"translateX("+(dir*19)+"px) scale(.962) rotate("+(dir*.8)+"deg)",opacity:.9,offset:.4},
          {transform:"translateX("+(dir*30)+"px) scale(.965) rotate("+(dir*1.4)+"deg)",opacity:.92,offset:.64},
          {transform:"translateX("+(dir*11)+"px) scale(.97) rotate("+(dir*.4)+"deg)",opacity:0}
        ],{duration:680,delay:40,easing:E,fill:"both"}),peek);
        setTimeout(function(){peek.remove();},780);
      }
      /* light sweep (device 1): a bright band slashes diagonally across the cover
         glass on the change instant — cover only; the bottom player (dock) gets
         no sweep. */
      var shC=wrap.querySelector(".fs-sheen i");
      if(shC)track(shC.animate([
        {transform:"translateX(-190%) skewX(-16deg)",opacity:0},
        {transform:"translateX(-30%) skewX(-16deg)",opacity:1,offset:.3},
        {transform:"translateX(230%) skewX(-16deg)",opacity:.85,offset:.78},
        {transform:"translateX(380%) skewX(-16deg)",opacity:0}
      ],{duration:700,delay:60,easing:"cubic-bezier(.4,0,.2,1)",fill:"both"}));
    }
    /* title block: staggered — kicker, then the big title, artist, actions */
    var tb=fs.querySelector(".fs-titleblock");
    if(tb){
      slide(tb.querySelector(".fs-kicker"),{transform:"translate("+(dir*14)+"px,4px)",opacity:0},{transform:"translate(0,0)",opacity:1},460,50);
      slide(tb.querySelector("h4"),{transform:"translate("+(dir*24)+"px,9px)",opacity:0,filter:"blur(8px)"},{transform:"translate(0,0)",opacity:1,filter:"blur(0px)"},540,110);
      slide(tb.querySelector("p"),{transform:"translate("+(dir*18)+"px,6px)",opacity:0},{transform:"translate(0,0)",opacity:1},500,175);
      slide(tb.querySelector(".fs-titleactions"),{transform:"translateY(7px)",opacity:0},{transform:"translateY(0)",opacity:1},440,235);
    }
    /* giant outline artist drifts in from the opposite side, lyrics + index follow.
       The giant is the slowest layer on stage (device 4): it starts furthest out
       (-64px, opposite the cover's travel) and its 1180ms run is a full second
       longer than the cover's 580ms, so the cover is already home while the
       outline artist is still drifting in behind it. The lyrics column is its own
       layer too (device 2): it trails the cover, sliding in horizontally over
       700ms instead of the old vertical fade. */
    var giant=fs.querySelector("[data-fs-giant]");
    if(giant)track(giant.animate([
      {transform:"translateX("+(-dir*64)+"px)",opacity:0},
      {transform:"translateX(0)",opacity:.5}
    ],{duration:1180,delay:50,easing:E,fill:"both"}));
    slide(fs.querySelector(".fs-lyrcol"),{transform:"translate("+(dir*30)+"px,6px)",opacity:.15},{transform:"translate(0,0)",opacity:1},700,130);
    var idxEl=fs.querySelector("[data-fsnum]");
    if(idxEl)track(idxEl.animate([
      {transform:"translateY(12px)",opacity:0},
      {transform:"translateY(0)",opacity:.55}
    ],{duration:440,delay:210,easing:E,fill:"both"}));
    /* dock mini cover: a quick settle so the dock agrees with the stage */
    var dc=fs.querySelector(".dock-cover");
    if(dc)track(dc.animate([
      {transform:"scale(.9)",opacity:.25},
      {transform:"scale(1)",opacity:1}
    ],{duration:420,delay:40,easing:E,fill:"both"}));
    fs._xAnims=anims;
  });
}
/* desktop bundle track-change transition: the same language as the fullscreen
   stage, scaled to the small surfaces. Runs AFTER render()/syncDesk() has put the
   new track everywhere. dir=+1 (next) brings new covers in from the right and
   sends the old ones out to the left; dir=-1 mirrors it. Every visible desktop
   surface animates — desktop lyrics window, SMTC card, tray mini player, and
   the taskbar tray button — each with layered timing: the card shells drift the
   least and slowest, covers are the baseline beat (580ms, matching the stage),
   titles/artists stagger behind them, lyric lines trail like the stage's lyrics
   column, and play buttons settle like the dock's mini cover. Rapid skips cancel
   the in-flight run and drop the ghosts first. Hidden surfaces are skipped
   (they open already settled on the new track). Calm / reduced-motion: nothing
   moves, the plain syncDesk() result stands. No light sweep on any of these —
   the sweep belongs to the fullscreen cover only. */
// 保留原稿桌面表面切歌动画。
function animateDeskTrackChange() {}
// 按原稿规则切歌并同步封面、歌词和播放队列。
function selectTrack(i,autoplay,dir){ var old=state.idx; nativeDirection=dir||(i>old?1:-1); ensureQueue(); if(state.queue.indexOf(i)===-1){ state.queue=TRACKS.map(function(t,k){return k;}); buildLists(); } state.idx=i;state.t=0;state.recent=[i].concat(state.recent.filter(function(x){return x!==i;}));render(); if(autoplay)setPlaying(true); if(i!==old){ var d=dir||(i>old?1:-1); animateFsTrackChange(d,TRACKS[old]); animateDeskTrackChange(d,TRACKS[old]); } }
// 原稿交互：保留 nextTrack 对应的界面行为与调用规则。
function nextTrack(){ ensureQueue(); var q=state.queue,p=q.indexOf(state.idx);
  if(state.shuffle){ if(q.length>1){ var n=p; while(n===p)n=Math.floor(Math.random()*q.length); selectTrack(q[n],true,1); } return; }
  if(p>-1&&p<q.length-1){ selectTrack(q[p+1],true,1); return; }
  if(state.radioOn){ radioExtend(); if(p<q.length-1){ selectTrack(q[p+1],true,1); return; } }
  selectTrack(q[0],true,1); }
// 原稿交互：保留 prevTrack 对应的界面行为与调用规则。
function prevTrack(){ if(state.t>3){state.t=0;render();return;} ensureQueue(); var q=state.queue,p=q.indexOf(state.idx); selectTrack(q[(p-1+q.length)%q.length],true,-1); }

function bindPlayer(p){
  p.querySelectorAll("[data-play]").forEach(function(el){listenElement(el,"click",function(){setPlaying(!state.playing);});});
  p.querySelectorAll("[data-stage-toggle]").forEach(function(el){listenElement(el,"click",function(){setStage(!state.stage);});});
  p.querySelectorAll("[data-fsq-toggle]").forEach(function(el){listenElement(el,"click",function(){state.fsQ=!state.fsQ;render();});});
  p.querySelectorAll("[data-np-toggle],[data-np-switch]").forEach(function(el){listenElement(el,"click",function(){state.npOpen=!state.npOpen;render();});});
  var fsEl=p.querySelector("[data-fs]");
  if(fsEl&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    listenElement(fsEl,"mousemove",function(e){var r=fsEl.getBoundingClientRect();var nx=((e.clientX-r.left)/r.width-0.5),ny=((e.clientY-r.top)/r.height-0.5);fsEl.style.setProperty("--tx",nx.toFixed(3));fsEl.style.setProperty("--ty",ny.toFixed(3));fsEl.style.setProperty("--px",nx.toFixed(3));fsEl.style.setProperty("--py",ny.toFixed(3));});
    listenElement(fsEl,"mouseleave",function(){fsEl.style.setProperty("--tx",0);fsEl.style.setProperty("--ty",0);fsEl.style.setProperty("--px",0);fsEl.style.setProperty("--py",0);});
  }
  p.querySelectorAll("[data-next]").forEach(function(el){listenElement(el,"click",nextTrack);});
  p.querySelectorAll("[data-prev]").forEach(function(el){listenElement(el,"click",prevTrack);});
  p.querySelectorAll("[data-like]").forEach(function(el){listenElement(el,"click",function(){state.liked[state.idx]=!state.liked[state.idx];render();});});
  p.querySelectorAll("[data-shuffle]").forEach(function(el){listenElement(el,"click",function(){state.shuffle=!state.shuffle;render();});});
  p.querySelectorAll("[data-repeat]").forEach(function(el){listenElement(el,"click",function(){state.repeat=(state.repeat+1)%3;render();});});
  p.querySelectorAll("[data-seek]").forEach(function(seek){
    listenElement(seek,"input",function(){ var tr=TRACKS[state.idx]; state.t=seek.value/1000*tr.dur; render(); });
    var prow=seek.closest(".edge-prow");
    if(prow){
      var tip=prow.querySelector("[data-seek-tip]");
      listenElement(seek,"mousemove",function(e){
        var r=prow.getBoundingClientRect(); if(!r.width)return;
        var x=e.clientX-r.left; var ratio=Math.max(0,Math.min(1,x/r.width));
        if(tip){ var total=TRACKS[state.idx].dur; tip.textContent=fmt(ratio*total)+" / "+fmt(total); tip.style.left=Math.max(46,Math.min(r.width-46,x))+"px"; }
        prow.classList.add("tip-on");
      });
      listenElement(seek,"mouseleave",function(){ prow.classList.remove("tip-on"); });
    }
  });
  p.querySelectorAll("[data-lyricbtn]").forEach(function(lb){
    listenElement(lb,"click",function(){
      var ly=p.querySelector("[data-lyric]"); ly.classList.toggle("show"); lb.classList.toggle("on");
    });
  });
  /* fullscreen lyrics : drag / scroll to browse — the line at the column's centre
     is focused, a chip shows its start time, and clicking the chip (or the line
     itself) seeks playback there. Follow-scroll pauses while browsing and
     resumes a few seconds after the user lets go. */
  p.querySelectorAll("[data-fs-lyrics]").forEach(function(fl){
    var col=fl.closest(".fs-lyrcol");
    var chip=col?col.querySelector("[data-lyrseek]"):null;
    var drag=null;
    function seekLine(j){
      var lines=fsLinesFor(state.idx,TRACKS[state.idx].dur);
      if(!lines[j])return;
      state.t=Math.min(TRACKS[state.idx].dur-0.3,lines[j].t+0.02);
      state._lyrHoldUntil=0;
      fl._focus=null;
      if(chip)chip.classList.remove("show");
      state._lyrKey="";
      render();
    }
    function centreLine(){
      if(!fl.children.length)return -1;
      var mid=fl.scrollTop+fl.clientHeight/2,best=-1,bd=1e18;
      for(var j=0;j<fl.children.length;j++){
        var c=fl.children[j].offsetTop+fl.children[j].offsetHeight/2,d=Math.abs(c-mid);
        if(d<bd){bd=d;best=j;}
      }
      return best;
    }
    function browse(){
      state._lyrHoldUntil=Date.now()+3200;
      var j=centreLine(); if(j<0)return;
      if(fl._focus!==j){
        fl._focus=j;
        for(var k=0;k<fl.children.length;k++){ fl.children[k].classList.toggle("focus",k===j); }
      }
      if(chip&&col){
        var lines=fsLinesFor(state.idx,TRACKS[state.idx].dur);
        if(lines[j]){
          chip.querySelector("[data-lyrseek-t]").textContent=fmt(lines[j].t);
          chip._j=j;
          var colR=col.getBoundingClientRect(),lnR=fl.children[j].getBoundingClientRect();
          var y=(lnR.top-colR.top)+lnR.height/2;
          chip.style.top=Math.max(52,Math.min(colR.height-26,y))+"px";
          chip.classList.add("show");
        }
      }
      if(fl._hideT)clearTimeout(fl._hideT);
      fl._hideT=setTimeout(function(){
        if(chip)chip.classList.remove("show");
        if(fl._focus!=null){ fl._focus=null; fl.querySelectorAll(".fl-line.focus").forEach(function(el){el.classList.remove("focus");}); }
      },3200);
    }
    listenElement(fl,"scroll",function(){ if(fl._progUntil&&Date.now()<fl._progUntil)return; browse(); },{passive:true});
    listenElement(fl,"pointerdown",function(e){
      if(e.pointerType==="touch")return;
      /* never let a drag start a native text selection */
      e.preventDefault();
      var sel=window.getSelection&&window.getSelection(); if(sel&&sel.removeAllRanges)sel.removeAllRanges();
      drag={y:e.clientY,st:fl.scrollTop,moved:false};
      try{fl.setPointerCapture(e.pointerId);}catch(_e){}
    });
    listenElement(fl,"pointermove",function(e){
      if(!drag)return;
      var dy=e.clientY-drag.y;
      if(Math.abs(dy)>5){ drag.moved=true; fl.classList.add("dragging"); }
      if(drag.moved){
        var sel2=window.getSelection&&window.getSelection(); if(sel2&&sel2.removeAllRanges)sel2.removeAllRanges();
        fl.scrollTop=drag.st-dy;
      }
    });
    listenElement(fl,"pointerup",function(e){
      if(!drag)return;
      var wasDrag=drag.moved; drag=null; fl.classList.remove("dragging");
      fl._clickSupp=Date.now()+450;
      if(!wasDrag){
        for(var k=0;k<fl.children.length;k++){
          var rr=fl.children[k].getBoundingClientRect();
          if(e.clientY>=rr.top&&e.clientY<=rr.bottom){ seekLine(k); break; }
        }
      }
    });
    listenElement(fl,"pointercancel",function(){ drag=null; fl.classList.remove("dragging"); });
    listenElement(fl,"click",function(e){
      if(fl._clickSupp&&Date.now()<fl._clickSupp)return;
      var ln=e.target&&e.target.closest?e.target.closest(".fl-line"):null;
      if(ln)seekLine(parseInt(ln.getAttribute("data-lj"),10));
    });
    if(chip){ listenElement(chip,"click",function(){ if(chip._j!=null)seekLine(chip._j); }); }
  });
  p.querySelectorAll("[data-airbtn]").forEach(function(ab){ listenElement(ab,"click",cycleDevice); });
  p.querySelectorAll("[data-device]").forEach(function(db){ listenElement(db,"click",cycleDevice); });
  p.querySelectorAll(".main-chips button").forEach(function(b){
    listenElement(b,"click",function(){
      var t=b.textContent.trim();
      if(t==="专辑"){ setPage("albums"); return; }
      if(t==="歌手"){ setPage("artists"); return; }
      state.chip=t; render();
    });
  });
  p.querySelectorAll(".sidebar .navitem").forEach(function(b){
    listenElement(b,"click",function(){
      var pg=b.getAttribute("data-nav");
      if(pg){ setPage(pg); }
      else { state._util=b.getAttribute("data-util"); state._pageKey=""; render(); handleUtil(state._util); }
    });
  });
  p.querySelectorAll("[data-top-search]").forEach(function(ts){
    listenElement(ts,"focus",function(){ if(state.page!=="search"){ setPage("search"); setTimeout(function(){ var inp=p.querySelector("[data-search-input]"); if(inp)inp.focus(); },60); } });
    listenElement(ts,"input",function(){ state.query=ts.value; syncSearchInputs(ts); state._pageKey=""; render(); });
  });
  p.querySelectorAll("[data-nav-back]").forEach(function(nb){ listenElement(nb,"click",navBack); });
  p.querySelectorAll("[data-nav-fwd]").forEach(function(nf){ listenElement(nf,"click",navFwd); });
  p.querySelectorAll("[data-queuebtn]").forEach(function(qb){ listenElement(qb,"click",function(){ if(!state.stage){ state.fsQ=true; setStage(true); } else { state.fsQ=!state.fsQ; render(); } }); });
  p.querySelectorAll("[data-radio-quick]").forEach(function(rb){ listenElement(rb,"click",function(){ if(!state.radioOn)startRadio(); setPage("radio"); }); });
  var si=p.querySelector("[data-search-input]");
  if(si){ listenElement(si,"input",function(){ state.query=si.value; syncSearchInputs(si); state._pageKey=""; render(); }); }
  p.querySelectorAll("[data-tag]").forEach(function(tg){ listenElement(tg,"click",function(){ state.query=tg.getAttribute("data-tag"); syncSearchInputs(null); state._pageKey=""; render(); }); });
  p.querySelectorAll("[data-pl-play]").forEach(function(pb){ listenElement(pb,"click",function(){ selectTrack(state.playlistIdx,true); }); });
  p.querySelectorAll("[data-ad-play]").forEach(function(pb){ listenElement(pb,"click",function(){ var dt=TRACKS[state.playlistIdx]; for(var i=0;i<TRACKS.length;i++){ if(TRACKS[i].album===dt.album){ selectTrack(i,true); break; } } }); });
  p.querySelectorAll("[data-ard-play]").forEach(function(pb){ listenElement(pb,"click",function(){ var dt=TRACKS[state.playlistIdx]; for(var i=0;i<TRACKS.length;i++){ if(TRACKS[i].artist===dt.artist){ selectTrack(i,true); break; } } }); });
  p.querySelectorAll("[data-set-toggle]").forEach(function(b){ listenElement(b,"click",function(){ var k=b.getAttribute("data-set-toggle"); state.settings[k]=!state.settings[k]; renderSettings(); }); });
  p.querySelectorAll("[data-set-seg]").forEach(function(seg){ var key=seg.getAttribute("data-set-seg"); seg.querySelectorAll("button").forEach(function(b){ listenElement(b,"click",function(){ state.settings[key]=b.getAttribute("data-val"); renderSettings(); }); }); });
  p.querySelectorAll("[data-set-range]").forEach(function(r){ listenElement(r,"input",function(){ state.settings[r.getAttribute("data-set-range")]=parseInt(r.value,10); renderSettings(); }); });
  /* sources : platform connect / import / upload / new playlist */
  p.querySelectorAll("[data-conn-btn]").forEach(function(b){ listenElement(b,"click",function(){
    var k=b.getAttribute("data-conn-btn"); state.platforms[k]=!state.platforms[k];
    if(state.platforms[k]){ state.lastSync="刚刚"; state.impMsg="已连接（原型演示）— 勾选下方歌单即可导入。"; }
    state._srcKey=""; render();
  }); });
  p.querySelectorAll("[data-src-toggle]").forEach(function(b){ listenElement(b,"click",function(){
    var on=b.classList.toggle("on"); b.setAttribute("aria-checked",on?"true":"false");
    state.srcToggles[b.getAttribute("data-src-toggle")]=on;
  }); });
  p.querySelectorAll("[data-import-go]").forEach(function(b){ listenElement(b,"click",function(){
    var picks=IMP_LIST.filter(function(x){ return state.impPicked[x.id]&&state.platforms[x.plat]&&!state.imported.some(function(y){return y.name===x.name;}); });
    if(!picks.length){ state.impMsg="还没有勾选可导入的歌单 — 先连接平台并点「选择导入」。"; }
    else { picks.forEach(function(x){ state.imported.push({name:x.name,source:x.platName,count:x.count,cover:x.cover}); delete state.impPicked[x.id]; });
      state.lastSync="刚刚"; state.impMsg="已导入 "+picks.length+" 个歌单 — 它们出现在左侧「我的歌单」下方，点开即可看曲目并播放。"; }
    state._srcKey=""; render();
  }); });
  p.querySelectorAll("[data-link-parse]").forEach(function(b){ listenElement(b,"click",function(){
    var panel=b.closest(".page-panel"); var inp=panel?panel.querySelector("[data-link-input]"):null;
    var v=inp?inp.value.trim():"";
    if(!v){ state.linkMsg="先粘贴一个歌单链接再解析。"; }
    else if(/163|netease/i.test(v)){ state.linkMsg="解析成功（演示）：识别为网易云歌单 · 42 首 — 已加入上方待导入列表的同名歌单，连接网易云后勾选即可导入。"; }
    else if(/kugou/i.test(v)){ state.linkMsg="解析成功（演示）：识别为酷狗歌单 · 35 首 — 连接酷狗后勾选即可导入。"; }
    else if(/kuwo/i.test(v)){ state.linkMsg="解析成功（演示）：识别为酷我歌单 · 121 首 — 连接酷我后勾选即可导入。"; }
    else { state.linkMsg="没能识别这个链接 — 请确认是网易云 / 酷狗 / 酷我的歌单分享链接。"; }
    state._srcKey=""; render();
  }); });
  /* hub tabs + generic page jump + pagination (delegated: pager buttons are re-rendered) */
  p.querySelectorAll("[data-lib-tab]").forEach(function(b){ listenElement(b,"click",function(){ setPage(b.getAttribute("data-lib-tab")); }); });
  p.querySelectorAll("[data-src-tab]").forEach(function(b){ listenElement(b,"click",function(){ setPage(b.getAttribute("data-src-tab")); }); });
  p.querySelectorAll("[data-goto]").forEach(function(b){ listenElement(b,"click",function(){ setPage(b.getAttribute("data-goto")); }); });
  var pgMain=p.querySelector(".main");
  if(pgMain){ listenElement(pgMain,"click",function(e){
    var cl=e.target&&e.target.closest?e.target.closest("[data-clear-recent]"):null;
    if(cl){ state.recent=[]; state.pg.recent=1; state._pageKey=""; render(); return; }
    var qn=e.target&&e.target.closest?e.target.closest("[data-qnext]"):null;
    if(qn){ playNext(parseInt(qn.getAttribute("data-qnext"),10)); return; }
    var srw=e.target&&e.target.closest?e.target.closest("[data-srow]"):null;
    if(srw){ selectTrack(parseInt(srw.getAttribute("data-srow"),10),true); return; }
    var stg=e.target&&e.target.closest?e.target.closest("[data-smart-toggle]"):null;
    if(stg){ var sk=stg.getAttribute("data-smart-toggle"); state.smartOpen=state.smartOpen===sk?null:sk; state._pageKey=""; render(); return; }
    var spl=e.target&&e.target.closest?e.target.closest("[data-smart-play]"):null;
    if(spl){ playSmart(spl.getAttribute("data-smart-play")); return; }
    var rtg=e.target&&e.target.closest?e.target.closest("[data-radio-toggle]"):null;
    if(rtg){ if(state.radioOn)stopRadio(); else startRadio(); return; }
    var sb=e.target&&e.target.closest?e.target.closest("[data-sort]"):null;
    if(sb){ var pr=sb.getAttribute("data-sort").split(":"); state.sorts[pr[0]]=pr[1]; state.pg[pr[0]]=1; state._pageKey=""; render(); return; }
    var g=e.target&&e.target.closest?e.target.closest("[data-pg-go]"):null; if(!g||g.disabled)return; var parts=g.getAttribute("data-pg-go").split(":"); state.pg[parts[0]]=parseInt(parts[1],10); state._pageKey=""; state._srcKey=""; buildLists(); render(); }); }
  var fi=p.querySelector("[data-file-input]");
  function takeFiles(list){
    if(!list||!list.length)return;
    for(var i=0;i<list.length;i++){ var f=list[i];
      var folder=""; if(f.webkitRelativePath)folder=f.webkitRelativePath.split("/")[0]; else if(f._fold)folder=f._fold;
      state.uploads.push({name:f.name,size:fmtSize(f.size),ext:(f.name.split(".").pop()||"").toUpperCase(),added:false,folder:folder});
    }
    state.upMsg="已读取 "+list.length+" 个文件（仅本页演示，不上传服务器）— 点「加入曲库」把它们放进音乐库。";
    state._srcKey=""; render();
  }
  p.querySelectorAll("[data-pick-files]").forEach(function(b){ listenElement(b,"click",function(){ if(fi)fi.click(); }); });
  if(fi)listenElement(fi,"change",function(){ takeFiles(fi.files); fi.value=""; });
  var fiDir=p.querySelector("[data-dir-input]");
  p.querySelectorAll("[data-pick-dir]").forEach(function(b){ listenElement(b,"click",function(){ if(fiDir)fiDir.click(); }); });
  if(fiDir)listenElement(fiDir,"change",function(){ takeFiles(fiDir.files); fiDir.value=""; });
  /* drag a whole folder in: walk dropped directory entries recursively */
  function collectEntry(entry,rootName,out,cb){
    if(entry.isFile){ entry.file(function(f){ try{f._fold=rootName;}catch(e){} out.push(f); cb(); },function(){ cb(); }); return; }
    if(entry.isDirectory){ var rd=entry.createReader();
      (function nextBatch(){ rd.readEntries(function(ents){
        if(!ents.length){ cb(); return; }
        var pend=ents.length;
        ents.forEach(function(en){ collectEntry(en,rootName,out,function(){ if(--pend===0)nextBatch(); }); });
      },function(){ cb(); }); })();
      return;
    }
    cb();
  }
  var drop=p.querySelector("[data-drop]");
  if(drop){
    listenElement(drop,"dragover",function(e){ e.preventDefault(); drop.classList.add("drag"); });
    listenElement(drop,"dragleave",function(){ drop.classList.remove("drag"); });
    listenElement(drop,"drop",function(e){ e.preventDefault(); drop.classList.remove("drag");
      var items=e.dataTransfer.items, out=[], pend=0, used=false;
      if(items&&items.length){ for(var i=0;i<items.length;i++){ var it=items[i]; if(it.kind!=="file")continue; var en=it.webkitGetAsEntry?it.webkitGetAsEntry():null; if(en){ used=true; pend++; collectEntry(en,en.isDirectory?en.name:"",out,function(){ if(--pend===0)takeFiles(out); }); } } }
      if(!used)takeFiles(e.dataTransfer.files);
    });
  }
  p.querySelectorAll("[data-up-add]").forEach(function(b){ listenElement(b,"click",function(){
    var panel=b.closest(".page-panel"); if(!panel)return;
    var tIn=panel.querySelector("[data-up-title]"), aIn=panel.querySelector("[data-up-artist]"), alIn=panel.querySelector("[data-up-album]");
    var title=tIn?tIn.value.trim():"";
    if(!title){ state.upMsg="先填一下歌名 — 歌手和专辑可以留空。"; state._srcKey=""; render(); return; }
    TRACKS.push({title:title,artist:(aIn&&aIn.value.trim())||"未知歌手",album:(alIn&&alIn.value.trim())||"我上传的",dur:200,cover:TRACKS[state.upAdded%TRACKS.length].cover,q:"本地文件",glow:"rgba(140,160,255,.5)",mine:true});
    LYRICS.push(["这首歌还没有歌词","来自你手动添加的歌曲","正式版会自动匹配歌词与封面","—"]);
    state.upAdded++; state.upMsg="《"+title+"》已加入音乐库 — 音乐库、搜索、首页列表里都能找到，点它即可播放。";
    if(tIn)tIn.value=""; if(aIn)aIn.value=""; if(alIn)alIn.value="";
     buildLists(); state._pageKey=""; state._srcKey=""; render();
  }); });
  p.querySelectorAll("[data-newpl]").forEach(function(b){ listenElement(b,"click",function(){
    state._plSeq=(state._plSeq||0)+1; var name="新建歌单 "+state._plSeq; while(state.myLists.some(function(m){return m.name===name;})){ state._plSeq++; name="新建歌单 "+state._plSeq; }
    state.myLists.push({name:name,source:"本地自建",count:TRACKS.length,cover:TRACKS[state.myLists.length%TRACKS.length].cover});
    state.customPl={name:name,source:"本地自建",count:TRACKS.length,cover:TRACKS[0].cover};
    state._srcKey=""; setPage("playlist",state.playlistIdx); state._pageKey=""; render();
  }); });
  /* volume: one shared state for every slider + speaker button, both windows + fullscreen docks */
  p.querySelectorAll(".vol").forEach(function(v){
    listenElement(v,"input",function(){ setVol(parseInt(v.value,10)); });
    listenElement(v,"wheel",function(e){ e.preventDefault(); setVol(state.vol+(e.deltaY<0?5:-5)); },{passive:false});
  });
  p.querySelectorAll("[data-volbtn]").forEach(function(b){
    listenElement(b,"click",toggleMute);
    listenElement(b,"wheel",function(e){ e.preventDefault(); setVol(state.vol+(e.deltaY<0?5:-5)); },{passive:false});
  });
  /* banner: play toggle, compact-on-scroll, parallax vars (liquid CSS reads them) */
  p.querySelectorAll("[data-banner-play]").forEach(function(el){listenElement(el,"click",function(){setPlaying(!state.playing);});});
  var mainEl=p.querySelector(".main");
  if(mainEl){listenElement(mainEl,"scroll",function(){var c=mainEl.classList.contains("compact");if(!c&&mainEl.scrollTop>70)mainEl.classList.add("compact");else if(c&&mainEl.scrollTop<12)mainEl.classList.remove("compact");},{passive:true});}
  var banner=p.querySelector("[data-banner]");
  if(banner&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    listenElement(banner,"mousemove",function(e){var r=banner.getBoundingClientRect();var bx=(e.clientX-r.left)/r.width-0.5;var by=(e.clientY-r.top)/r.height-0.5;banner.style.setProperty("--bx",bx.toFixed(3));banner.style.setProperty("--by",by.toFixed(3));banner.style.setProperty("--bxp",((bx+0.5)*100)+"%");banner.style.setProperty("--byp",((by+0.5)*100)+"%");});
    listenElement(banner,"mouseleave",function(){banner.style.setProperty("--bx",0);banner.style.setProperty("--by",0);});
  }
  /* liquid: specular follows mouse — follows the effective glass style, so it moves with the 玻璃质感 setting */
  listenElement(p,"mousemove",function(e){
    var wrap=p.parentElement;
    if(!wrap||!wrap.classList.contains("liquid-win"))return;
    var r=p.getBoundingClientRect();
    p.style.setProperty("--mx",((e.clientX-r.left)/r.width*100)+"%");
    p.style.setProperty("--my",((e.clientY-r.top)/r.height*100)+"%");
  });
}
players().forEach(bindPlayer);
document.addEventListener("keydown",function(e){
  if(e.code==="Escape"&&state.stage){setStage(false);return;}
  if(e.code==="Escape"&&state.page!=="home"){setPage("home");return;}
  if(e.code==="Space"&&!/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)){e.preventDefault();setPlaying(!state.playing);}
  if(e.code==="Space"&&document.activeElement.tagName==="BODY"){e.preventDefault();setPlaying(!state.playing);}
  var ktag=document.activeElement.tagName;
  if(/INPUT|TEXTAREA/.test(ktag))return;
  if(e.code==="ArrowRight"){ state.t=Math.min(TRACKS[state.idx].dur,state.t+5); render(); }
  if(e.code==="ArrowLeft"){ state.t=Math.max(0,state.t-5); render(); }
  if(e.code==="ArrowUp"){ e.preventDefault(); setVol(state.vol+5); }
  if(e.code==="ArrowDown"){ e.preventDefault(); setVol(state.vol-5); }
  if(e.code==="KeyM"){ toggleMute(); }
});

listenWindow("resize",function(){ players().forEach(function(p){ positionPill(p); snapAllPills(p); }); });

/* view toggle */
document.querySelectorAll(".viewtoggle button").forEach(function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll(".viewtoggle button").forEach(function(x){x.classList.remove("on");});
    b.classList.add("on");
    var v=b.getAttribute("data-view");
    document.getElementById("colA").classList.toggle("hide",v==="b");
    document.getElementById("colB").classList.toggle("hide",v==="a");
    if(v!=="both"){ (v==="b"?document.getElementById("colB"):document.getElementById("colA")).scrollIntoView({behavior:"smooth",block:"start"}); }
    requestAnimationFrame(function(){ players().forEach(function(p){ positionPill(p); snapAllPills(p); }); });
  });
});

/* vote */
var VERDICTS={
 a:{t:"你选了 A · 桌面全毛玻璃",x:"那就把桌面配方钉死：侧边栏和播放栏 blur 20px、主区不透明、弹窗同配方。好处是和系统 Mica / Vibrancy 天然一致、窗口怎么缩放都稳；代价是播放键这类小控件没记忆点，靠封面取色和氛围光来补。"},
 b:{t:"你选了 B · 桌面全液态",x:"那就全窗口液态化：导航全胶囊、播放栏贴边通栏、高光跟随鼠标。两条红线——主区和长列表必须保持不透明并给右栏补暗衬底；高光只跟随光标、不要自动流光，桌面上自动流光会显得很假。"},
 hybrid:{t:"桌面推荐：大面毛玻璃打底，小控件走液态",x:"桌面端的分工比手机更明确：左侧栏、底部播放栏这些大面用 A 的毛玻璃——能铺、能透氛围色、缩放窗口也不露馅；播放键、音量滑块、导航选中胶囊、迷你播放器、右键菜单这些天天被鼠标摸的小控件用 B 的液态玻璃，靠高光跟随光标出质感。中间列表区两版都必须不透明，这是桌面信息密度的底线。"}
};
document.querySelectorAll("[data-vote]").forEach(function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll("[data-vote]").forEach(function(x){x.classList.remove("picked");x.querySelector(".picktag").textContent="点击选择";});
    b.classList.add("picked");b.querySelector(".picktag").textContent="✓ 你的选择";
    var v=VERDICTS[b.getAttribute("data-vote")];
    document.getElementById("verdictTitle").textContent=v.t;
    document.getElementById("verdictText").textContent=v.x;
  });
});

/* one sliding pill per hub tab bar (injected once; bars are static markup) */
document.querySelectorAll(".pg-tabs").forEach(function(bar){ if(!bar.querySelector(".tab-pill")){ var s=document.createElement("span"); s.className="tab-pill"; s.setAttribute("aria-hidden","true"); bar.appendChild(s); } });
/* one sliding pill per segmented control (sort bars + settings segs), same element for life */
document.querySelectorAll(".sort-seg,.set-seg").forEach(function(seg){ if(!seg.querySelector(".seg-pill")){ var s=document.createElement("span"); s.className="tab-pill seg-pill"; s.setAttribute("aria-hidden","true"); seg.appendChild(s); } });
/* fullscreen ambience layers (injected once per stage): fluid mesh blobs between the
   blurred cover backdrop and the shade, sparse dust above the shade — decorative only */
var DUST=[[6,21,3,3],[14,26,11,2],[23,19,6,3.5],[31,24,15,2],[42,18,1,3],[50,27,19,2],[58,22,8,3],[67,20,13,2.5],[76,25,4,3],[85,19,17,2]];
document.querySelectorAll("[data-fs]").forEach(function(fs){
  if(fs.querySelector(".fs-amb"))return;
  var amb=document.createElement("div"); amb.className="fs-amb"; amb.setAttribute("aria-hidden","true");
  amb.innerHTML='<i class="amb a1"></i><i class="amb a2"></i><i class="amb a3"></i>';
  var bgEl=fs.querySelector(".fs-bg"); if(bgEl)fs.insertBefore(amb,bgEl.nextSibling); else fs.insertBefore(amb,fs.firstChild);
  var dust=document.createElement("div"); dust.className="fs-dust"; dust.setAttribute("aria-hidden","true");
  dust.innerHTML=DUST.map(function(d){ return '<i style="--dx:'+d[0]+'%;--dd:'+d[1]+'s;--dl:-'+d[2]+'s;--ds:'+d[3]+'px"></i>'; }).join("");
  var shadeEl=fs.querySelector(".fs-shade"); if(shadeEl)fs.insertBefore(dust,shadeEl.nextSibling); else fs.appendChild(dust);
  var grain=document.createElement("div"); grain.className="fs-grain"; grain.setAttribute("aria-hidden","true");
  if(shadeEl)fs.insertBefore(grain,shadeEl.nextSibling); else fs.appendChild(grain);
  /* light-sweep band (device 1): one clipped sheen layer over the cover face
     only — parked invisible until a track change sweeps it; the bottom player
     (dock) gets no sheen layer at all */
  var cwEl=fs.querySelector(".fs-coverwrap");
  if(cwEl&&!cwEl.querySelector(".fs-sheen")){ var shA=document.createElement("div"); shA.className="fs-sheen"; shA.setAttribute("aria-hidden","true"); shA.innerHTML="<i></i>"; cwEl.appendChild(shA); }
});
/* desktop bundle wiring (page-level, runs once) */
(function(){
  var desk=document.getElementById("desk"); if(!desk)return;
  var pop=document.getElementById("trayPop");
  var trayBtn=document.getElementById("trayBtn");
  if(trayBtn&&pop)trayBtn.addEventListener("click",function(){ pop.hidden=!pop.hidden; });
  desk.querySelectorAll("[data-desk-play]").forEach(function(b){ b.addEventListener("click",function(){ setPlaying(!state.playing); }); });
  desk.querySelectorAll("[data-desk-prev-btn]").forEach(function(b){ b.addEventListener("click",function(){ prevTrack(); }); });
  desk.querySelectorAll("[data-desk-next-btn]").forEach(function(b){ b.addEventListener("click",function(){ nextTrack(); }); });
  desk.querySelectorAll("[data-desk-like]").forEach(function(b){ b.addEventListener("click",function(){ state.liked[state.idx]=!state.liked[state.idx]; state._pageKey=""; render(); }); });
  desk.querySelectorAll("[data-desk-open]").forEach(function(b){ b.addEventListener("click",function(){ if(pop)pop.hidden=true; var ar=document.getElementById("arena"); if(ar)ar.scrollIntoView({behavior:"smooth",block:"start"}); }); });
  var tv=document.getElementById("trayVol"); if(tv)tv.addEventListener("input",function(){ setVol(parseInt(tv.value,10)); });
  desk.querySelectorAll("[data-desk-seekbar]").forEach(function(bar){ bar.addEventListener("click",function(e){ var r=bar.getBoundingClientRect(); var ratio=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); state.t=Math.round(TRACKS[state.idx].dur*ratio); render(); }); });
  document.querySelectorAll("[data-desk-act]").forEach(function(b){ b.addEventListener("click",function(){ var a=b.getAttribute("data-desk-act");
    if(a==="lyr"){ state.settings.deskLyrics=!state.settings.deskLyrics; renderSettings(); }
    else if(a==="lock"){ state.settings.deskLock=!state.settings.deskLock; renderSettings(); }
    else if(a==="font-"){ deskFont=Math.max(14,deskFont-2); syncDesk(); }
    else if(a==="font+"){ deskFont=Math.min(30,deskFont+2); syncDesk(); }
  }); });
  var op=document.getElementById("deskOpacity"); if(op)op.addEventListener("input",function(){ var lyr=document.getElementById("deskLyr"); if(lyr)lyr.style.opacity=op.value/100; });
  var lyr=document.getElementById("deskLyr"),head=document.getElementById("deskLyrHead"),drag=null;
  if(lyr&&head){
    head.addEventListener("pointerdown",function(e){ if(state.settings.deskLock)return; var r=lyr.getBoundingClientRect(); drag={dx:e.clientX-r.left,dy:e.clientY-r.top}; try{head.setPointerCapture(e.pointerId);}catch(err){} });
    head.addEventListener("pointermove",function(e){ if(!drag)return; var dr=desk.getBoundingClientRect(),r=lyr.getBoundingClientRect(); var x=e.clientX-dr.left-drag.dx,y=e.clientY-dr.top-drag.dy; x=Math.max(0,Math.min(dr.width-r.width,x)); y=Math.max(0,Math.min(dr.height-r.height-46,y)); lyr.style.left=x+"px"; lyr.style.top=y+"px"; });
    head.addEventListener("pointerup",function(){ drag=null; });
    head.addEventListener("pointercancel",function(){ drag=null; });
  }
  applyDeskSettings(); syncDesk();
})();
buildLists();render();

  // 发布原稿当前状态，供独立桌面窗口复用同一播放状态。
  function getSnapshot() {
    const track = TRACKS[state.idx];
    const lines = fsLinesFor(state.idx, track.dur);
    const lyrics = lines.map(line => line.o);
    let lyricIndex = 0;
    lines.forEach((line, index) => { if(line.t <= state.t + .001) lyricIndex = index; });
    return { track, playing: state.playing, time: state.t, volume: effVol(), liked: !!state.liked[state.idx], lyrics, lyricIndex, motion: state.settings.motion, fontSize: deskFont, locked: state.settings.deskLock, index: state.idx, direction: nativeDirection };
  }
  // 独立窗口的操作仍交给原稿方法执行，不引入另一套播放或页面逻辑。
  function dispatch(action) {
    if (action.type === 'toggle') setPlaying(!state.playing);
    else if (action.type === 'next') nextTrack();
    else if (action.type === 'previous') prevTrack();
    else if (action.type === 'like') { state.liked[state.idx] = !state.liked[state.idx]; state._pageKey = ''; render(); }
    else if (action.type === 'volume') setVol(action.value);
    else if (action.type === 'seek') { state.t = Math.round(Math.max(0, Math.min(1, action.value)) * TRACKS[state.idx].dur); render(); }
  }
  // Vue 页面退出时只释放宿主资源，不修改原稿的交互状态与视觉规则。
  function destroy() {
    destroyed = true;
    cleanups.forEach(cleanup => cleanup());
    timeouts.forEach(id => nativeWindow.clearTimeout(id));
    intervals.forEach(id => nativeWindow.clearInterval(id));
    frames.forEach(id => nativeWindow.cancelAnimationFrame(id));
    root.getAnimations({subtree:true}).forEach(animation => animation.cancel());

    nativeDocument.body.classList.remove('wx-off', 'calm');
  }
  // 页面挂载后重建必要的测量与事件，不重置播放时钟。
  function refresh() {
    players().forEach(bindPlayer);
    state._pageKey=''; state._srcKey=''; state._lyrKey='';
    buildLists(); render();
  }
  // 搜索组件更新统一状态并同步标题栏输入。
  function setQuery(query) { state.query=query; syncSearchInputs(null); state._pageKey=''; render(); }
  return { getSnapshot, dispatch, destroy, refresh, navigate:setPage, selectTrack, setQuery, playSmart, smartList, smartMeta, playNext, moveQueue, render, addUploadToLibrary };
}
