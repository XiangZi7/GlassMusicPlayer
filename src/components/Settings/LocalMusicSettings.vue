<script setup lang="ts">
import { useLocalMusicStore } from '@/stores/modules/localMusic'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { formatTime } from '@/utils/audioUtils'

const { t } = useI18n()
const localMusicStore = useLocalMusicStore()
const { musics, isLoading } = storeToRefs(localMusicStore)
const { setPlaylist, play } = useAudio()

const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  localMusicStore.loadMusics()
})

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const files = Array.from(target.files)
    for (const file of files) {
      await localMusicStore.addMusic(file)
    }
    // 清空 input，允许再次选择相同文件
    target.value = ''
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleDelete = async (id: string) => {
  await localMusicStore.deleteMusic(id)
}

const handlePlayAll = () => {
  if (musics.value.length === 0) return
  const songs = musics.value.map(m => localMusicStore.convertToSong(m))
  setPlaylist(songs, 0)
  play(songs[0], 0)
}

const handlePlayOne = (music: any) => {
  // 如果当前播放列表已经是本地音乐，则直接播放，否则替换播放列表
  // 这里简化处理，直接替换播放列表并播放该首
  // 也可以优化为：如果当前列表包含该歌曲，则跳转；否则替换列表
  const songs = musics.value.map(m => localMusicStore.convertToSong(m))
  const index = songs.findIndex(s => s.id === music.id)
  if (index !== -1) {
    setPlaylist(songs, index)
    play(songs[index], index)
  }
}
</script>

<template>
  <div class="glass-card space-y-5 rounded-2xl p-5">
    <div class="flex items-center justify-between border-b border-white/10 pb-4">
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-600"
        >
          <span class="icon-[mdi--folder-music-outline] h-5 w-5 text-white" />
        </div>
        <div>
          <h3 class="text-primary text-sm font-semibold">
            {{ t('components.settings.localMusic') }}
          </h3>
          <p class="text-primary/50 text-xs">
            {{ t('components.settings.localMusicDesc') }}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-white/20"
          @click="handlePlayAll"
          :disabled="musics.length === 0"
          :class="{ 'opacity-50 cursor-not-allowed': musics.length === 0 }"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </button>
        <button
          class="flex items-center gap-1 rounded-lg bg-primary/20 text-primary px-3 py-1.5 text-xs transition-colors hover:bg-primary/30"
          @click="triggerFileInput"
        >
          <span class="icon-[mdi--upload] h-4 w-4" />
          {{ t('actions.upload') }}
        </button>
      </div>
    </div>

    <input
      type="file"
      ref="fileInput"
      class="hidden"
      multiple
      accept="audio/*"
      @change="handleFileChange"
    />

    <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
      <div v-if="isLoading" class="text-center text-xs text-primary/50 py-4">
        <span class="icon-[mdi--loading] animate-spin h-5 w-5 mr-2"></span>
        {{ t('common.loading') }}
      </div>
      <div v-else-if="musics.length === 0" class="text-center text-xs text-primary/50 py-4">
        {{ t('common.noData') }}
      </div>
      <div
        v-else
        v-for="music in musics"
        :key="music.id"
        class="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5"
      >
        <div class="flex items-center gap-3 overflow-hidden" @click="handlePlayOne(music)">
           <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-primary/40 group-hover:text-primary cursor-pointer">
              <span class="icon-[mdi--music] h-4 w-4"></span>
           </div>
           <div class="flex flex-col overflow-hidden cursor-pointer">
             <span class="text-primary truncate text-xs font-medium">{{ music.name }}</span>
             <span class="text-primary/50 text-[10px]">{{ formatTime(music.duration) }} • {{ (music.file.size / 1024 / 1024).toFixed(2) }} MB</span>
           </div>
        </div>
        
        <button
          class="text-primary/40 hover:text-red-400 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          @click="handleDelete(music.id)"
          :title="t('common.delete')"
        >
          <span class="icon-[mdi--trash-can-outline] h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
