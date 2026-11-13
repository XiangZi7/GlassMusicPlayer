import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
let s=read('src/components/player/PlayerSidebar.vue');
s=s.replace('</script>',`import {computed} from 'vue';\nimport {usePlayer} from '@/composables/usePlayer';\nconst {state,tracks,controller}=usePlayer();\nconst albums=computed(()=>tracks.map((_,index)=>index).filter(index=>tracks.findIndex(track=>track.album===tracks[index]!.album)===index));\n// 内置歌单保留原稿按专辑定位、轮换曲库预览的行为。\nfunction openPlaylist(index:number):void {state.customPl=null;controller()?.navigate('playlist',index);}\n</script>`);
s=s.replace('<div data-sidebar-lists></div>',`<div data-sidebar-lists><BaseButton v-for="index in albums" :key="index" class="plist" :class="{on:state.page==='playlist'&&!state.customPl&&tracks[state.playlistIdx]!.album===tracks[index]!.album}" @click="openPlaylist(index)"><img :src="tracks[index]!.cover" alt=""><span>{{tracks[index]!.album}}</span></BaseButton></div>`);
write('src/components/player/PlayerSidebar.vue',s);
for(const [file,pattern,replacement] of [
 ['PlayerNowPlaying',/<div class="queue" data-queue><\/div>/,'<QueueList />'],
 ['PlayerFullscreen',/<div[^>]*data-fs-queue-list[^>]*><\/div>/,'<QueueList fullscreen />'],
]){
 let v=read(`src/components/player/${file}.vue`);
 v=v.replace('</script>',"import QueueList from '@/components/player/QueueList.vue';\n</script>");
 v=v.replace(pattern,replacement);
 write(`src/components/player/${file}.vue`,v);
}
console.log('Migrated sidebar and both queue views.');
