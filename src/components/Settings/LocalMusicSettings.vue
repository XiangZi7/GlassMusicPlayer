<script setup lang="ts">
import { useLocalMusicStore } from '@/stores/modules/localMusic'
import { useAudio } from '@/composables/useAudio'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { formatTime } from '@/utils/audioUtils'
import Button from '@/components/Ui/Button.vue'

const { t } = useI18n()
const localMusicStore = useLocalMusicStore()
const { musics, isLoading } = storeToRefs(localMusicStore)
const { setPlaylist, play } = useAudio()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

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

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'))
    for (const file of audioFiles) {
      await localMusicStore.addMusic(file)
    }
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
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
  const songs = musics.value.map(m => localMusicStore.convertToSong(m))
  const index = songs.findIndex(s => s.id === music.id)
  if (index !== -1) {
    setPlaylist(songs, index)
    play(songs[index], index)
  }
}
</script>

<template>
  <div
    class="glass-card overflow-hidden rounded-3xl transition-all"
    :class="{ 'ring-offset-overlay ring-2 ring-green-500 ring-offset-2': isDragging }"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <!-- 头部操作栏 -->
    <div class="flex items-center justify-between border-b border-(--glass-border) p-6">
      <div class="flex items-center gap-4">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-600 shadow-md"
        >
          <span class="icon-[mdi--folder-music-outline] h-6 w-6 text-white" />
        </div>
        <div>
          <h3 class="text-primary text-base font-semibold">
            {{ t('components.settings.localMusic') }}
          </h3>
          <p class="text-primary/60 text-sm">
            {{ musics.length }} {{ t('commonUnits.songs', { count: musics.length }) }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <Button
          variant="soft"
          size="sm"
          rounded="lg"
          class="gap-2"
          @click="handlePlayAll"
          :disabled="musics.length === 0"
        >
          <span class="icon-[mdi--play] h-4 w-4" />
          {{ t('actions.playAll') }}
        </Button>
        <Button
          variant="solid"
          size="sm"
          rounded="lg"
          class="gap-2 shadow-md"
          @click="triggerFileInput"
        >
          <span class="icon-[mdi--upload] h-4 w-4" />
          {{ t('actions.upload') }}
        </Button>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      type="file"
      ref="fileInput"
      class="hidden"
      multiple
      accept="audio/*"
      @change="handleFileChange"
    />

    <!-- 拖拽提示 -->
    <div
      v-if="isDragging"
      class="absolute inset-0 z-20 flex items-center justify-center bg-green-500/10 backdrop-blur-sm"
    >
      <div class="text-center">
        <div class="mb-4 flex justify-center">
          <div class="rounded-full bg-green-500/20 p-6">
            <span class="icon-[mdi--cloud-upload] h-16 w-16 text-green-500"></span>
          </div>
        </div>
        <p class="text-primary text-lg font-semibold">{{ t('components.settings.dropFiles') }}</p>
        <p class="text-primary/60 mt-2 text-sm">{{ t('components.settings.dropFilesHint') }}</p>
      </div>
    </div>

    <!-- 音乐列表 -->
    <div class="max-h-[500px] overflow-y-auto p-6">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="text-primary/50 flex items-center justify-center py-12">
        <span class="icon-[mdi--loading] mr-2 h-6 w-6 animate-spin"></span>
        <span class="text-sm font-medium">{{ t('common.loading') }}</span>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="musics.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="mb-4 rounded-full bg-white/5 p-6">
          <span class="icon-[mdi--music-note-off] text-primary/20 h-12 w-12"></span>
        </div>
        <p class="text-primary/60 mb-2 text-sm font-medium">{{ t('common.noData') }}</p>
        <p class="text-primary/40 mb-4 text-xs">{{ t('components.settings.localMusicEmpty') }}</p>
        <Button variant="soft" size="sm" rounded="lg" class="gap-2" @click="triggerFileInput">
          <span class="icon-[mdi--plus] h-4 w-4" />
          {{ t('components.settings.addMusic') }}
        </Button>
      </div>

      <!-- 音乐列表 -->
      <div v-else class="space-y-2">
        <div
          v-for="music in musics"
          :key="music.id"
          class="group hover:bg-hover-glass flex items-center justify-between rounded-xl p-3 transition-all"
        >
          <div
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            @click="handlePlayOne(music)"
          >
            <div
              class="glass-card text-primary/50 group-hover:text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors"
            >
              <span class="icon-[mdi--music] h-6 w-6"></span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-primary mb-1 truncate text-sm font-semibold">{{ music.name }}</p>
              <div class="text-primary/60 flex items-center gap-3 text-xs">
                <span class="flex items-center gap-1">
                  <span class="icon-[mdi--clock-outline] h-3.5 w-3.5"></span>
                  {{ formatTime(music.duration) }}
                </span>
                <span class="flex items-center gap-1">
                  <span class="icon-[mdi--file-outline] h-3.5 w-3.5"></span>
                  {{ (music.file.size / 1024 / 1024).toFixed(2) }} MB
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            rounded="full"
            class="text-primary/40 ml-3 rounded-lg p-2 transition-all hover:bg-red-500/10 hover:text-red-400"
            @click="handleDelete(music.id)"
            :title="t('common.delete')"
            icon="mdi--trash-can-outline"
            icon-class="h-5 w-5"
          />
        </div>
      </div>
    </div>
  </div>
</template>
