<script setup lang="ts">
import { computed } from 'vue'
import PlaylistLayout from '@/components/player/PlaylistLayout.vue'
import TrackRow from '@/components/player/TrackRow.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { usePlayer } from '@/composables/usePlayer'
import { defaultCover } from '@/constants/music'
import { catalogKey } from '@/services/player/catalog'
import { sortTrackIndices } from '@/services/player/library'
import type { SourceTrack } from '@/types/prototype'

const props = defineProps<{
  songs: SourceTrack[]
  date: string
  source: string
  official: boolean
  loading: boolean
  failed: boolean
  current?: SourceTrack['catalog']
}>()
const emit = defineEmits<{ play: [position: number, order: number[]]; retry: [] }>()
const { state } = usePlayer()
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
const dateLabel = computed(() => dateFormat.format(new Date(props.date + 'T00:00:00Z')))
const cover = computed(() => props.songs.find(song => song.cover && song.cover !== defaultCover)?.cover)
const order = computed(() => sortTrackIndices(props.songs, props.songs.map((_, index) => index), state.sorts.daily))
</script>

<template>
  <section class="daily-playlist" aria-label="每日推荐">
    <PlaylistLayout list-key="daily" title="每日推荐" :cover="cover"
      :description="official ? '根据你的网易云音乐口味生成，每天 06:00（北京时间）更新' : source"
      :meta="songs.length ? '共 ' + songs.length + ' 首' : ''" :playable="!!songs.length"
      :show-list-tools="!!songs.length" @play="emit('play', 0, order)">
      <template #kicker>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3v5m9-5v5M4 10.5h16"/>
        </svg>
        <time :datetime="date">{{ dateLabel }}</time>
      </template>
      <ol v-if="songs.length" class="m-0 list-none p-0" aria-label="每日推荐曲目">
        <li v-for="(index, position) in order" :key="index">
          <TrackRow :track="songs[index]!" :number="position + 1"
            :active="!!current && !!songs[index]?.catalog && catalogKey(current) === catalogKey(songs[index]!.catalog!)"
            @play="emit('play', position, order)" />
        </li>
      </ol>
      <div v-else class="grid min-h-40 justify-items-center place-content-center gap-3 text-sm text-white/75">
        <p role="status">{{ loading ? '正在读取推荐歌单…' : failed ? '暂时无法获取推荐歌单' : '今天暂无推荐曲目' }}</p>
        <BaseButton v-if="failed && !loading" class="rounded-full border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/20" @click="emit('retry')">重新获取</BaseButton>
      </div>
    </PlaylistLayout>
  </section>
</template>
