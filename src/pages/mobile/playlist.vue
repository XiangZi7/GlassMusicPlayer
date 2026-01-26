<script setup lang="ts">
import { playlistDetail, playlistTrackAll } from '@/api'
import { useAudio } from '@/composables/useAudio'
import LazyImage from '@/components/Ui/LazyImage.vue'
import PlaylistCommentsPopup from '@/components/Mobile/PlaylistCommentsPopup.vue'
import Button from '@/components/Ui/Button.vue'
import { useI18n } from 'vue-i18n'
import { formatCount } from '@/utils/time'
import {
  transformPlaylistDetail,
  transformSongs,
  type SongData,
} from '@/utils/transformers'

const { t } = useI18n()

type PlaylistInfo = {
  name: string
  description: string
  creator: string
  creatorAvatar: string
  createTime: string
  songCount: number
  playCount: number | string
  likes: number | string
  category: string
  coverImgUrl: string
}

const route = useRoute()
const playlistId = computed(() => Number(route.params.id))

const state = reactive({
  info: {} as PlaylistInfo,
  songs: [] as SongData[],
  loading: true,
  collected: false,
  showFullDesc: false,
  showComments: false,
})

const { setPlaylist, play } = useAudio()

const load = async (id: number) => {
  try {
    const [detailRes, tracksRes] = await Promise.all([
      playlistDetail({ id }),
      playlistTrackAll({ id, limit: 100 }),
    ])

    const detail = transformPlaylistDetail(
      detailRes as Record<string, unknown>,
      t('home.playlistFallback')
    )
    if (detail) {
      state.info = {
        ...detail,
        playCount: formatCount(detail.playCount as number),
        likes: formatCount(detail.likes as number),
      }
    }

    state.songs = transformSongs(tracksRes as Record<string, unknown>)
  } finally {
    state.loading = false
  }
}

watch(
  playlistId,
  idNum => {
    if (!Number.isNaN(idNum) && idNum > 0) {
      state.loading = true
      state.showFullDesc = false
      load(idNum)
    }
  },
  { immediate: true }
)

const playAll = () => {
  if (!state.songs.length) return
  setPlaylist(state.songs, 0)
  play(state.songs[0], 0)
}

const shufflePlay = () => {
  if (!state.songs.length) return
  const shuffled = [...state.songs].sort(() => Math.random() - 0.5)
  setPlaylist(shuffled, 0)
  play(shuffled[0], 0)
}

const toggleCollect = () => {
  state.collected = !state.collected
}
</script>

<template>
  <div class="playlist-page flex flex-1 flex-col overflow-hidden">
    <div v-if="state.loading" class="flex-1 overflow-auto px-4 py-6">
      <PageSkeleton :sections="['hero', 'list']" :list-count="8" />
    </div>
    <template v-else>
      <div class="header-section relative">
        <div class="header-bg absolute inset-0 overflow-hidden">
          <LazyImage
            v-if="state.info.coverImgUrl"
            :src="state.info.coverImgUrl + '?param=400y400'"
            :alt="$t('components.songList.coverAlt')"
            imgClass="h-full w-full object-cover scale-110"
          />
          <div class="header-overlay absolute inset-0"></div>
        </div>

        <div class="header-content relative z-10 px-4 pt-4 pb-6">
          <div class="flex gap-4">
            <div class="cover-wrapper relative shrink-0">
              <LazyImage
                v-if="state.info.coverImgUrl"
                :src="state.info.coverImgUrl + '?param=300y300'"
                :alt="$t('components.songList.coverAlt')"
                imgClass="cover-image h-32 w-32 rounded-2xl object-cover"
              />
              <div
                class="play-count-badge absolute -right-1 -bottom-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-accent"
              >
                <span class="icon-[mdi--play] h-3 w-3"></span>
                {{ state.info.playCount }}
              </div>
            </div>

            <div class="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div>
                <h1 class="mb-2 line-clamp-2 text-lg leading-tight font-bold text-accent">
                  {{ state.info.name }}
                </h1>
                <div class="creator-info flex items-center gap-2">
                  <img
                    v-if="state.info.creatorAvatar"
                    :src="state.info.creatorAvatar + '?param=50y50'"
                    alt=""
                    class="h-5 w-5 rounded-full"
                  />
                  <span class="text-xs text-accent/70">{{ state.info.creator }}</span>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-3 text-[11px] text-accent/60">
                <span class="flex items-center gap-1">
                  <span class="icon-[mdi--music-note] h-3.5 w-3.5"></span>
                  {{ $t('commonUnits.songsShort', state.info.songCount) }}
                </span>
                <span class="flex items-center gap-1">
                  <span class="icon-[mdi--heart] h-3.5 w-3.5"></span>
                  {{ state.info.likes }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="state.info.description"
            class="desc-section mt-4"
            @click="state.showFullDesc = !state.showFullDesc"
          >
            <p
              class="text-xs leading-relaxed text-accent/60"
              :class="state.showFullDesc ? '' : 'line-clamp-2'"
            >
              {{ state.info.description }}
            </p>
            <span class="mt-1 inline-flex items-center text-[10px] text-accent/60">
              {{ state.showFullDesc ? $t('common.collapse') : $t('common.expand') }}
              <span
                :class="state.showFullDesc ? 'icon-[mdi--chevron-up]' : 'icon-[mdi--chevron-down]'"
                class="h-3 w-3"
              ></span>
            </span>
          </div>
        </div>
      </div>

      <div class="action-bar flex items-center gap-3 px-4 py-3">
        <Button
          variant="gradient"
          size="md"
          rounded="full"
          class="play-all-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
          icon="icon-[mdi--play-circle]"
          icon-class="h-5 w-5"
          @click="playAll"
        >
          {{ t('actions.playAll') }}
        </Button>
        <Button
          variant="glass"
          size="md"
          rounded="full"
          class="shuffle-btn flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
          icon="icon-[mdi--shuffle-variant]"
          icon-class="h-5 w-5"
          @click="shufflePlay"
        >
          {{ t('actions.shufflePlay') }}
        </Button>
        <Button
          variant="glass"
          size="icon-lg"
          rounded="full"
          class="collect-btn"
          :class="state.collected ? 'collected' : ''"
          :icon="state.collected ? 'icon-[mdi--heart]' : 'icon-[mdi--heart-outline]'"
          icon-class="h-5 w-5"
          @click="toggleCollect"
        />
        <Button
          variant="glass"
          size="icon-lg"
          rounded="full"
          class="comment-btn"
          icon="icon-[mdi--message-processing-outline]"
          icon-class="h-5 w-5"
          @click="state.showComments = true"
        />
        <PlaylistCommentsPopup
          v-model:show="state.showComments"
          :id="playlistId"
          type="playlist"
        />
      </div>

      <div class="flex-1 overflow-auto px-4 pb-6">
        <section>
          <MobileSongList :songs="state.songs" :show-index="true" />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.header-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(40px) saturate(1.5);
  -webkit-backdrop-filter: blur(40px) saturate(1.5);
}

.header-overlay {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.5) 50%,
    var(--glass-bg-solid) 100%
  );
}

.cover-wrapper {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
}

.cover-image {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.play-count-badge {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.4));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.play-all-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35);
  transition: all 0.3s ease;
}

.play-all-btn:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);
}

.shuffle-btn {
  background: var(--glass-card-bg);
  color: var(--glass-text-primary);
  border: 1px solid var(--glass-border-default);
  transition: all 0.3s ease;
}

.shuffle-btn:active {
  transform: scale(0.97);
  background: var(--glass-interactive-hover-muted);
}

.collect-btn {
  background: var(--glass-card-bg);
  color: var(--glass-text-primary);
  border: 1px solid var(--glass-border-default);
  transition: all 0.3s ease;
}

.collect-btn:active {
  transform: scale(0.95);
}

.collect-btn.collected {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
  border-color: rgba(236, 72, 153, 0.3);
  color: #ec4899;
}

.comment-btn {
  background: var(--glass-card-bg);
  color: var(--glass-text-primary);
  border: 1px solid var(--glass-border-default);
  transition: all 0.3s ease;
}

.comment-btn:active {
  transform: scale(0.95);
}

.desc-section {
  cursor: pointer;
}
</style>
