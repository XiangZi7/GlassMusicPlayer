<script setup lang="ts">
import { computed } from 'vue'
import LibraryTabs from '@/components/player/LibraryTabs.vue'
import PlayerTabs from '@/components/player/PlayerTabs.vue'
import TrackList from '@/components/player/TrackList.vue'
import { usePlayer } from '@/composables/usePlayer'
import { formatTime } from '@/utils/format'

const { tracks } = usePlayer()
const indices = computed(() => tracks.map((_, index) => index))
const totalTime = computed(() =>
  formatTime(tracks.reduce((sum, track) => sum + track.dur, 0))
)
</script>

<template>
  <div
    class="page-panel hidden h-full"
    data-panel="library"
  >
    <div class="flex h-full min-h-0 flex-col">
      <!-- 音乐库页头横幅：波普插画图右文左，标题与曲目数坐左侧薄荷留白区，深色字保证对比。 -->
      <div class="lib-pop-banner">
        <img
          class="lib-pop-art"
          src="/images/pop-library.webp"
          alt=""
          decoding="async"
        />
        <div class="lib-pop-text">
          <h3>音乐库</h3>
          <p>{{ indices.length }} 首歌曲 · 共 {{ totalTime }}</p>
        </div>
      </div>
      <!-- 音乐库分类：每个标签页独立展示对应内容。 -->
      <LibraryTabs flush />
      <!-- 空库状态：贴纸框插画作空态视觉，替代排序行与列表。 -->
      <div
        v-if="!indices.length"
        class="lib-pop-empty"
      >
        <img
          class="pop-sticker pop-sticker--framed lib-pop-empty-art"
          style="--pop-sticker-angle: -3deg"
          src="/images/pop-boombox.webp"
          alt=""
          decoding="async"
        />
        <b>曲库还是空的</b>
        <p>去「内容导入」关联平台歌单或登记本地曲目，歌曲会出现在这里。</p>
      </div>
      <template v-else>
        <div
          class="mt-3 flex flex-none flex-wrap items-center justify-between gap-2"
        >
          <!-- 歌曲排序：复用播放器排序按钮。 -->
          <PlayerTabs
            kind="segment"
            class="sort-seg inline-flex gap-[3px] rounded-full p-[3px]"
            role="group"
            aria-label="列表排序"
            hook="data-sort"
            :options="[
              { label: '默认', value: 'lib:def' },
              { label: '歌名', value: 'lib:title' },
              { label: '歌手', value: 'lib:artist' },
              { label: '时长', value: 'lib:dur' },
            ]"
          />
          <span class="text-xs opacity-70"
            >{{ indices.length }} 首 · {{ totalTime }}</span
          >
        </div>
        <div
          class="table-head mt-3 mb-1 grid flex-none grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_52px_34px] items-center gap-[10px] px-[10px] pb-2 text-[11px] font-extrabold tracking-[.08em] opacity-50"
        >
          <span>#</span><span>标题</span><span>专辑</span>
          <span class="text-right">时长</span><span></span>
        </div>
        <!-- 曲库列表：根据当前窗口可用高度分页。 -->
        <TrackList
          :indices="indices"
          list-key="lib"
          fit-height
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 页头波普横幅：插画铺满、人物在右，左侧薄荷留白承载深色标题，高度克制不挤压列表。 */
.lib-pop-banner {
  position: relative;
  flex: none;
  height: 136px;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 20px;
}
.lib-pop-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 32%;
}
.lib-pop-text {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  padding: 0 26px;
  color: var(--pop-ink);
}
.lib-pop-text h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.lib-pop-text p {
  margin: 5px 0 0;
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.72;
}
/* 空库视觉：贴纸框插画居中，文案跟随其后，占满列表剩余高度。 */
.lib-pop-empty {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
}
.lib-pop-empty-art {
  width: 156px;
  height: 156px;
  margin-bottom: 8px;
  border-radius: 20px;
  object-fit: cover;
}
.lib-pop-empty b {
  font-size: 15px;
  font-weight: 800;
}
.lib-pop-empty p {
  margin: 0;
  max-width: 340px;
  font-size: 12.5px;
  line-height: 1.65;
  opacity: 0.6;
}
</style>
