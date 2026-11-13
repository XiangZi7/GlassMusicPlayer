import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const mappings={
 'index/index':[['tracklist','home','allIndices']],
 search:[['search-results','search','searchIndices']],
 library:[['lib-list','lib','allIndices'],['lib-liked-list','libLiked','likedIndices']],
 playlist:[['pl-list','pl','playlistIndices']],
 album:[['ad-list','ad','albumIndices']],
 artist:[['ard-list','ard','artistIndices']],
 liked:[['liked-list','liked','likedIndices']],
 recent:[['recent-list','recent','state.recent']],
 upload:[['up-list','up','uploadedIndices']],
};
const computedDefs={
 allIndices:'tracks.map((_,index)=>index)',
 likedIndices:'tracks.map((_,index)=>index).filter(index=>state.liked[index])',
 searchIndices:'tracks.map((_,index)=>index).filter(index=>{const track=tracks[index]!;return !state.query.trim()||(track.title+" "+track.artist+" "+track.album).toLowerCase().includes(state.query.trim().toLowerCase());})',
 playlistIndices:'tracks.map((_,index)=>(state.playlistIdx+index)%tracks.length)',
 albumIndices:'tracks.map((_,index)=>index).filter(index=>tracks[index]!.album===tracks[state.playlistIdx]!.album)',
 artistIndices:'tracks.map((_,index)=>index).filter(index=>tracks[index]!.artist===tracks[state.playlistIdx]!.artist)',
 uploadedIndices:'tracks.map((_,index)=>index).filter(index=>tracks[index]!.mine)',
};
for(const[file,lists]of Object.entries(mappings)){
 let s=read(`src/pages/${file}.vue`);
 const defs=new Set(lists.map(x=>x[2]).filter(x=>computedDefs[x]));
 for(const[hook,key,indices]of lists){
  const pattern=new RegExp(`<div data-${hook}></div>\\s*<div class="pager" data-pager="${key}"></div>`);
  s=s.replace(pattern,`<!-- 歌曲列表组件：统一曲目选择、排序、分页及播放状态。 -->\n<TrackList :indices="${indices}" list-key="${key}"${key==='libLiked'?' empty="还没有收藏的歌曲 — 在播放栏或全屏页点爱心，收藏的歌会出现在这里。"':''} />`);
 }
 s=s.replace('</script>',`import {computed} from 'vue';\nimport TrackList from '@/components/player/TrackList.vue';\nimport {usePlayer} from '@/composables/usePlayer';\nconst {state,tracks,controller}=usePlayer();\n${[...defs].map(n=>`const ${n}=computed(()=>${computedDefs[n]});`).join('\n')}\n</script>`);
 if(file==='index/index'){
  s=s.replace('<div class="feat-grid" data-feat-grid></div>',`<!-- 推荐专辑组件区：按原稿点击封面即播。 -->\n<div class="feat-grid"><BaseButton v-for="index in albumIndicesForCards" :key="index" class="feat" :class="{on:tracks[index]!.album===tracks[state.idx]!.album}" :data-ti="index" @click="controller()?.selectTrack(index,true)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.album+' 封面'"><b>{{tracks[index]!.album}}</b><span>{{tracks[index]!.artist}}</span></BaseButton></div>`);
  s=s.replace('</script>',`const albumIndicesForCards=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.album===tracks[i]!.album)===i));\n</script>`);
 }
 if(file==='search'){
  s=s.replace('<div class="artist-row" data-artist-row></div>',`<!-- 歌手筛选卡片区：沿用原稿封面、文字与点击筛选。 -->\n<div class="artist-row"><BaseButton v-for="index in artistCards" :key="index" class="artist-card" @click="controller()?.setQuery(tracks[index]!.artist)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.artist"><b>{{tracks[index]!.artist}}</b><span>{{tracks[index]!.album}}</span></BaseButton></div>`);
  s=s.replace('</script>',`const artistCards=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.artist===tracks[i]!.artist)===i));\n</script>`);
 }
 write(`src/pages/${file}.vue`,s);
}
for(const page of ['albums','artists']){
 let s=read(`src/pages/${page}.vue`);
 const album=page==='albums', field=album?'album':'artist';
 s=s.replace('</script>',`import {computed} from 'vue';\nimport {usePlayer} from '@/composables/usePlayer';\nimport {formatTime} from '@/utils/format';\nconst {tracks,controller}=usePlayer();\nconst indices=computed(()=>tracks.map((_,i)=>i).filter(i=>tracks.findIndex(t=>t.${field}===tracks[i]!.${field})===i));\n</script>`);
 s=s.replace(new RegExp(`<div class="${album?'feat-grid':'artist-row'}" data-${page}-grid[^>]*></div>`),`<!-- ${album?'专辑':'歌手'}卡片区：按原稿排版进入详情页。 -->\n<div class="${album?'feat-grid':'artist-row'}" style="margin-top:16px"><BaseButton v-for="index in indices" :key="index" class="${album?'feat':'artist-card'}" @click="controller()?.navigate('${album?'album':'artist'}',index)"><img :src="tracks[index]!.cover" :alt="tracks[index]!.${field}"><b>{{tracks[index]!.${field}}}</b><span>{{${album?"tracks[index]!.artist+' · '+tracks[index]!.q":"tracks[index]!.album+' · '+formatTime(tracks[index]!.dur)"}}}</span></BaseButton></div>`.replaceAll('}}}','}}'));
 write(`src/pages/${page}.vue`,s);
}
let runtime=read('src/services/player/runtime.js').replaceAll('buildPills();','');
// 上传列表已由 Vue 接管，不再调用移除的 DOM 行生成器。
runtime=runtime.replace(/    var ul=p.querySelector[\s\S]*?(?=    var ue=)/,'');
write('src/services/player/runtime.js',runtime);
console.log('Migrated all track lists and album/artist grids to Vue.');
