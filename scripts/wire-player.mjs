import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const pages=['search','library','albums','artists','album','artist','liked','recent','playlist','radio','settings','connect','upload','downloads','hub'];
write('src/router/index.ts', `import { createRouter, createWebHashHistory } from 'vue-router';
export const router = createRouter({history:createWebHashHistory(),routes:[
{path:'/',component:()=>import('@/layouts/player-layout.vue'),children:[
{path:'',name:'home',component:()=>import('@/pages/index/index.vue'),meta:{playerPage:'home'}},
${pages.map(p=>`{path:'${p}',component:()=>import('@/pages/${p}.vue'),meta:{playerPage:'${p}'}}`).join(',\n')}
]},
{path:'/desktop/:mode',component:()=>import('@/pages/desktop.vue')},
{path:'/:pathMatch(.*)*',redirect:'/'}]});`);

let s=read('scripts/.player-before.js').replaceAll('\r\n','\n');
s=s.replace(/^import[^\n]+\n/, `import { shortLyrics as LYRICS, fullLyrics as LYR_FULL, lyricPools as LYR_POOL, importPlaylists as IMP_LIST, downloads as DL_LIST } from '@/constants/music';\n`);
s=s.slice(0,s.indexOf('var TRACKS='))+`const TRACKS=options.tracks;\n`+s.slice(s.indexOf('// 转义曲目'));
s=s.slice(0,s.indexOf('var IMP_LIST='))+s.slice(s.indexOf('var ICON_PLAY='));
s=s.replace(/var state=\{[^\n]+\};/, 'const state=options.state;');

// 用语法括号定位函数，保留其余原稿动画和交互参数。
function functionRange(name){
 const start=s.indexOf(`function ${name}(`);
 const open=s.indexOf('{',start);let depth=1,i=open+1,quote='',comment='';
 for(;i<s.length;i++){
  const c=s[i],n=s[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue;}
  if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
  if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if(c==='{')depth++;if(c==='}'&&!--depth)break;
 }
 return [start,i+1];
}
function replaceFunction(name,replacement){const[a,b]=functionRange(name);s=s.slice(0,a)+replacement+s.slice(b);}

// 高频列表交由 Vue 的 keyed 组件渲染，原稿控制器只维护领域状态。
replaceFunction('buildLists','function buildLists(){ ensureQueue(); }');
replaceFunction('buildPills','');
replaceFunction('renderPager','');
replaceFunction('makeTrow','');
replaceFunction('trowHTML','');
replaceFunction('buildQueueInto','');
replaceFunction('radioRow','');
replaceFunction('smartRow','');
replaceFunction('smartCardEl','');
replaceFunction('syncDesk','function syncDesk() {}');
replaceFunction('applyDeskSettings','function applyDeskSettings() {}');
replaceFunction('animateDeskTrackChange','function animateDeskTrackChange() {}');

// 真实路由切换仍保留原稿历史栈；路由回调不再次导航。
const[a,b]=functionRange('setPage');
let setPage=s.slice(a,b);
setPage=setPage.replace('viaNav)', 'viaNav)');
setPage=setPage.replace('state._pageKey=""; render();','state._pageKey=""; if(!viaNav&&options.onNavigate)options.onNavigate(pg,state.playlistIdx); render();');
s=s.slice(0,a)+setPage+s.slice(b);
// 历史按钮也需更新真实路由，viaNav 只控制原稿历史栈。
s=s.replace('setPage(h.page,h.playlistIdx,true);','setPage(h.page,h.playlistIdx,true); options.onNavigate(h.page,h.playlistIdx);');
s=s.replace('setPage(f.page,f.playlistIdx,true);','setPage(f.page,f.playlistIdx,true); options.onNavigate(f.page,f.playlistIdx);');

// 新页面只需同步导航与详情元数据，不再生成歌曲行或专辑卡片 HTML。
const[ra,rb]=functionRange('renderPages');
let rp=s.slice(ra,rb);
rp=rp.slice(0,rp.indexOf('    var q=state.query'))+rp.slice(rp.indexOf('    var ptr=TRACKS[state.playlistIdx]'));
rp=rp.replace(/    var pll=p.querySelector[\s\S]*?(?=    if\(state.page==="playlist")/,'');
rp=rp.replace(/    var ag=p.querySelector[\s\S]*?(?=    var dtr=)/,'');
rp=rp.replace(/    var adl=p.querySelector[^\n]+\n/,'').replace(/    var arl=p.querySelector[^\n]+\n/,'');
rp=rp.replace(/    var lkl=p.querySelector[^\n]+\n/,'').replace(/    var rl=p.querySelector[^\n]+\n/,'');
rp=rp.replace(/    var rseed=p.querySelector[\s\S]*?(?=    p.querySelectorAll\("\[data-radio-toggle\])/,'');
rp=rp.replace(/    var rlist=p.querySelector[\s\S]*?(?=    positionPill\(p\))/,'');
rp=rp.replace('    positionTabPills(p,false);','').replace('    positionSegPills(p,false);','');
s=s.slice(0,ra)+rp+s.slice(rb);

// 组件拥有标签和分页胶囊；窗口缩放时由 VueUse 的 ResizeObserver 定位。
for(const name of ['positionPgPill','positionTabPills','positionSegPills','segBtnKey','snapAllPills'])replaceFunction(name,`function ${name}() {}`);
s=s.replace(/  document.getElementById\("syncPlay"\)\.innerHTML=[^\n]+\n/,'');
s=s.replace(/document.getElementById\("syncPlay"\)\.addEventListener[^\n]+\n/,'');
s=s.replace('buildPills();buildLists();render();','buildLists();render();');
s=s.replace('    clearSourcePaginations();','');

// 页面按路由挂载；同一元素同一监听仅注册一次，避免后退时双触发。
s=s.replace('players().forEach(function(p){\n  p.querySelectorAll("[data-play]")','function bindPlayer(p){\n  p.querySelectorAll("[data-play]")');
const bindStart=s.indexOf('function bindPlayer(p)');
const bindEnd=s.indexOf('\n});', s.indexOf('/* mouse position',bindStart));
// 以初始化块后面的 syncPlay / keydown 边界定位结束。
const keydown=s.indexOf('document.addEventListener("keydown"',bindStart);
const closure=s.lastIndexOf('});',keydown);
s=s.slice(0,closure)+'}\nplayers().forEach(bindPlayer);'+s.slice(closure+3);
// 将绑定块内的 native addEventListener 统一交由去重辅助方法注册。
const bs=s.indexOf('function bindPlayer(p)'),be=s.indexOf('players().forEach(bindPlayer);',bs);
let binding=s.slice(bs,be);
binding=binding.replace(/([a-zA-Z_$][\w$]*)\.addEventListener\(/g,'listenElement($1,');
s=s.slice(0,bs)+binding+s.slice(be);
s=s.replace('  const frames = new Set();',`  const frames = new Set();
  const bound = new WeakMap();
  // 路由组件重复挂载时只绑定新节点，公共布局监听在卸载时统一释放。
  function listenElement(el, type, handler, config) {
    const key=type+'|'+handler.toString();
    let keys=bound.get(el); if(!keys){ keys=new Set(); bound.set(el,keys); }
    if(keys.has(key))return; keys.add(key);
    el.addEventListener(type,handler,config);
  }`);
s=s.replace('  return { getSnapshot, dispatch, destroy };',`  // 页面挂载后重建必要的测量与事件，不重置播放时钟。
  function refresh() {
    players().forEach(bindPlayer);
    state._pageKey=''; state._srcKey=''; state._lyrKey='';
    buildLists(); render();
  }
  // 搜索组件更新统一状态并同步标题栏输入。
  function setQuery(query) { state.query=query; syncSearchInputs(null); state._pageKey=''; render(); }
  return { getSnapshot, dispatch, destroy, refresh, navigate:setPage, selectTrack, setQuery, playSmart, smartList, smartMeta, playNext, moveQueue, render, addUploadToLibrary };`);
write('src/services/player/runtime.js',s);

// 修正独立窗口动画导入位置。
write('src/pages/desktop.vue',read('src/pages/desktop.vue').replaceAll('@/pages/index/source-desktop-animation','@/services/player/desktop-motion'));
console.log('Wired persistent player layout and 16 real route pages.');

