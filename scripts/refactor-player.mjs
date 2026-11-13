import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vueRequire = createRequire(fs.realpathSync(require.resolve('vue/package.json')));
const { parse } = vueRequire('@vue/compiler-dom');
const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const original = read('src/pages/index/source-player.js');
const context = {};
vm.runInNewContext(original.slice(original.indexOf('var TRACKS='), original.indexOf('// 转义曲目')), context);
const imports = original.slice(original.indexOf('var IMP_LIST='), original.indexOf('var ICON_PLAY='));
vm.runInNewContext(imports, context);
write('src/constants/music.ts', `import type { SourceTrack } from '@/types/prototype';\n\n// 原稿曲库与歌词逐项保留，页面和独立桌面窗口共用同一份数据。\nexport const tracks: SourceTrack[] = ${JSON.stringify(context.TRACKS, null, 2)};\nexport const shortLyrics: string[][] = ${JSON.stringify(context.LYRICS, null, 2)};\nexport const fullLyrics: string[][][] = ${JSON.stringify(context.LYR_FULL, null, 2)};\nexport const lyricPools: Record<string, string[][]> = ${JSON.stringify(context.LYR_POOL, null, 2)};\nexport const importPlaylists = ${JSON.stringify(context.IMP_LIST, null, 2)};\nexport const downloads = ${JSON.stringify(context.DL_LIST, null, 2)};\n`);

const content = read('src/pages/index/components/source-content.vue');
const template = content.slice(content.indexOf('<template>') + 10, content.lastIndexOf('</template>'));
const main = parse(template).children.find(n => n.tag === 'main');
const panels = main.children.filter(n => n.tag === 'div' && n.props.some(p => p.name === 'data-panel'));
const firstPanel = panels[0].loc.start.offset;
let home = template.slice(main.loc.start.offset, firstPanel).replace(/<main class="main">/, '<div class="home-content">') + '</div>';
const script = `<script setup lang="ts">\nimport BaseButton from '@/components/ui/BaseButton.vue';\nimport SlidingTabs from '@/components/ui/SlidingTabs.vue';\n</script>\n\n`;
for (const panel of panels) {
  const name = panel.props.find(p => p.name === 'data-panel').value.content;
  write(`src/pages/${name}.vue`, script + `<template>\n<!-- ${name} 页面：保留原稿内容区域与交互顺序。 -->\n${panel.loc.source}\n</template>\n`);
}
const homeTree = parse(home).children.find(n => n.tag === 'div');
const banner = homeTree.children.find(n => n.tag === 'section' && n.props.some(p => p.name === 'data-banner'));
write('src/pages/index/components/featured-banner.vue', `<script setup lang="ts">\nimport BaseButton from '@/components/ui/BaseButton.vue';\n</script>\n<template>\n<!-- 首页主打区：保留封面叠层、收缩和鼠标视差。 -->\n${banner.loc.source}\n</template>`);
home = home.replace(banner.loc.source, '<!-- 首页主打横幅组件：展示当前主打、叠层封面与视差。 -->\n<FeaturedBanner />');
write('src/pages/index/index.vue', `<script setup lang="ts">\nimport BaseButton from '@/components/ui/BaseButton.vue';\nimport FeaturedBanner from '@/pages/index/components/featured-banner.vue';\n</script>\n<template>\n<!-- 首页内容区：推荐专辑、曲库列表与分页。 -->\n${home}\n</template>`);

// 播放器布局跨所有页面复用，页面私有组件只保留首页横幅。
const shellNames = ['titlebar', 'sidebar', 'now-playing', 'fullscreen', 'player-bar'];
for (const name of shellNames) {
  write(`src/components/player/Player${name.split('-').map(p=>p[0].toUpperCase()+p.slice(1)).join('')}.vue`, read(`src/pages/index/components/source-${name}.vue`));
}
write('src/services/player/runtime.js', original.replace('"@/pages/index/source-pagination"', '"@/services/player/pagination"'));
write('src/services/player/pagination.ts', read('src/pages/index/source-pagination.ts'));
write('src/services/player/desktop-motion.js', read('src/pages/index/source-desktop-animation.js'));
write('src/services/player/desktop-motion.d.ts', read('src/pages/index/source-desktop-animation.d.ts'));
write('src/services/player/runtime.d.ts', read('src/pages/index/source-player.d.ts'));

// 保存转换前源码用于计算迁移规则与本地对照；不进入最终源码。
write('scripts/.player-before.css', read('src/styles/main.css'));
write('scripts/.player-before.js', original);
console.log(`Extracted ${panels.length} route pages, shared shell and original music data.`);
