import { computed, onScopeDispose, reactive, toRefs, watch } from "vue";
import { defineStore } from "pinia";
import { useEventListener, useIntervalFn, useStorage } from "@vueuse/core";
import { demoTracks } from "@/constants/music";
import { readAudio, saveAudio } from "@/services/audio-storage";
import { notify } from "@/services/notification";
import type { PlayerSettings, Playlist, Track } from "@/types/music";

// 主窗口唯一的播放引擎，统一管理真实音频、演示曲目和持久化曲库。
export const usePlayerStore = defineStore("player", () => {
  // 响应式状态：音频、队列和持久化偏好由同一播放器统一管理。
  const state = reactive({
    // 正在播放的曲目编号。
    currentId: demoTracks[0]!.id,
    // 当前是否播放或预览。
    playing: false,
    // 已播放秒数。
    time: 42,
    // 当前曲目的实际时长。
    duration: demoTracks[0]!.duration,
    // 本地音频正在读取时禁止重复播放。
    loading: false,
    // 主窗口全屏播放舞台开关。
    fullscreen: false,
    // 当前音量，刷新应用后保留。
    volume: useStorage("mirai-volume", 70),
    // 静音前的音量。
    lastVolume: 70,
    // 随机播放模式。
    shuffle: false,
    // 循环模式：关闭、列表循环、单曲循环。
    repeat: 0,
    // 按顺序排列的播放队列。
    queue: demoTracks.map((track) => track.id),
    // 已收藏的歌曲编号。
    likedIds: useStorage<string[]>("mirai-liked", []),
    // 最近播放记录，按最近一次播放顺序排序。
    recentIds: useStorage<string[]>("mirai-recent", []),
    // 用户本地导入歌曲的元数据。
    localTracks: useStorage<Track[]>("mirai-local-tracks", []),
    // 用户创建或从分享数据导入的歌单。
    playlists: useStorage<Playlist[]>("mirai-playlists", []),
    // 播放次数用于生成智能歌单。
    playCounts: useStorage<Record<string, number>>("mirai-play-counts", {}),
    // 界面和睡眠定时器偏好。
    settings: useStorage<PlayerSettings>(
      "mirai-settings",
      {
        glass: "frosted",
        motion: true,
        weather: true,
        panelOpen: true,
        quality: "原始音质",
        sleep: 0,
      },
      undefined,
      { mergeDefaults: true },
    ),
    // 电台模式以当前歌曲为种子继续播放。
    radio: false,
  });
  const tracks = computed(() => [...demoTracks, ...state.localTracks]);
  const currentTrack = computed(
    () =>
      tracks.value.find((track) => track.id === state.currentId) ||
      demoTracks[0]!,
  );
  const albums = computed(() => [
    ...new Map(tracks.value.map((track) => [track.album, track])).values(),
  ]);
  const artists = computed(() => [
    ...new Map(tracks.value.map((track) => [track.artist, track])).values(),
  ]);
  const queueTracks = computed(() =>
    state.queue
      .map((id) => tracks.value.find((track) => track.id === id))
      .filter((track): track is Track => !!track),
  );
  const liked = computed(() => state.likedIds.includes(state.currentId));
  const lyricIndex = computed(() =>
    Math.min(
      currentTrack.value.lyrics.length - 1,
      Math.floor(
        (state.time / Math.max(state.duration, 1)) *
          currentTrack.value.lyrics.length,
      ),
    ),
  );
  const currentLyric = computed(
    () =>
      currentTrack.value.lyrics[Math.max(0, lyricIndex.value)]?.text ||
      "纯音乐 · 静静聆听",
  );
  const nextTrack = computed(
    () =>
      queueTracks.value[
        (queueTracks.value.findIndex((track) => track.id === state.currentId) +
          1) %
          queueTracks.value.length
      ],
  );
  const audio = new Audio();
  audio.preload = "metadata";
  let objectUrl = "";
  let selection = 0;
  let sleepEndsAt = 0;

  // 切换歌曲时终止旧音源，读取本地文件；演示曲目只更新预览进度。
  async function playTrack(id: string, autoplay = true): Promise<void> {
    const track = tracks.value.find((item) => item.id === id);
    if (!track) return;
    const request = ++selection;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    state.currentId = id;
    state.time = 0;
    state.duration = track.duration;
    state.playing = false;
    state.loading = false;
    if (!state.queue.includes(id)) state.queue.push(id);
    state.recentIds = [
      id,
      ...state.recentIds.filter((value) => value !== id),
    ].slice(0, 200);
    state.playCounts[id] = (state.playCounts[id] || 0) + 1;
    if (track.source === "demo") {
      state.playing = autoplay;
      return;
    }
    state.loading = true;
    try {
      const blob = await readAudio(id);
      if (request !== selection) return;
      if (!blob) throw new Error("未找到本地音频，请重新导入这首歌曲");
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      audio.volume = state.volume / 100;
      if (autoplay) await audio.play();
    } catch (error) {
      if (request === selection) {
        state.playing = false;
        notify(
          error instanceof Error
            ? error.message
            : "无法播放此格式的音频，请换一个文件",
          "error",
        );
      }
    } finally {
      if (request === selection) state.loading = false;
    }
  }

  // 从底栏、快捷键或桌面小窗切换播放状态，保留当前进度。
  async function togglePlayback(): Promise<void> {
    if (state.loading) return;
    if (currentTrack.value.source === "demo") {
      state.playing = !state.playing;
      return;
    }
    if (state.playing) audio.pause();
    else if (!audio.getAttribute("src")) await playTrack(state.currentId);
    else {
      try {
        await audio.play();
      } catch {
        notify("音频无法播放，请检查文件格式或重新导入", "error");
      }
    }
  }

  // 播放指定列表，并把列表顺序作为接下来播放的队列。
  function playAll(list: Track[]): void {
    if (!list.length) return;
    state.radio = false;
    state.queue = list.map((track) => track.id);
    void playTrack(list[0]!.id);
  }

  // 根据循环与随机模式切换下一首；自然播完且未循环时在队尾停止。
  function next(natural = false): void {
    if (!state.queue.length) return;
    const position = state.queue.indexOf(state.currentId);
    if (natural && state.repeat === 2) {
      void playTrack(state.currentId);
      return;
    }
    if (
      natural &&
      position === state.queue.length - 1 &&
      !state.repeat &&
      !state.radio
    ) {
      state.playing = false;
      state.time = state.duration;
      return;
    }
    const candidates = state.queue.filter((id) => id !== state.currentId);
    const id =
      state.shuffle && candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]!
        : state.queue[(position + 1) % state.queue.length]!;
    void playTrack(id);
  }

  // 返回队列中的上一首，支持单曲队列。
  function previous(): void {
    if (!state.queue.length) return;
    const position = state.queue.indexOf(state.currentId);
    void playTrack(
      state.queue[(position - 1 + state.queue.length) % state.queue.length]!,
    );
  }

  // 拖动进度条或点击歌词时，将音频和预览定位到目标秒数。
  function seek(time: number): void {
    state.time = Math.max(0, Math.min(state.duration, time));
    if (currentTrack.value.source === "local" && audio.readyState >= 1)
      audio.currentTime = state.time;
  }

  // 收藏按钮统一修改持久化收藏列表，曲库、底栏和歌词窗即时同步。
  function toggleLike(id = state.currentId): void {
    state.likedIds = state.likedIds.includes(id)
      ? state.likedIds.filter((value) => value !== id)
      : [...state.likedIds, id];
  }

  // 将歌曲插入当前曲目之后，保留队列中其他歌曲的相对顺序。
  function playNext(id: string): void {
    if (id === state.currentId) return;
    const queue = state.queue.filter((value) => value !== id);
    queue.splice(queue.indexOf(state.currentId) + 1, 0, id);
    state.queue = queue;
    notify("已添加到下一首播放");
  }

  // 队列拖动时将指定歌曲移动到目标歌曲之前。
  function reorderQueue(from: string, to: string): void {
    if (from === to || !state.queue.includes(from) || !state.queue.includes(to))
      return;
    const queue = state.queue.filter((id) => id !== from);
    queue.splice(queue.indexOf(to), 0, from);
    state.queue = queue;
  }

  // 用当前歌曲生成电台队列，同专辑优先，队尾自动继续循环。
  function startRadio(): void {
    const seed = currentTrack.value;
    state.queue = [
      seed.id,
      ...tracks.value
        .filter((track) => track.id !== seed.id)
        .sort(
          (a, b) =>
            Number(b.album === seed.album) - Number(a.album === seed.album),
        )
        .map((track) => track.id),
    ];
    state.radio = true;
    if (!state.playing) void togglePlayback();
  }

  // 添加一首真实本地音频，先存储文件成功再写入曲库，避免留下不可播放的记录。
  async function importFile(file: File): Promise<Track | undefined> {
    const duplicate = state.localTracks.find(
      (track) =>
        track.fileName === `${file.name}:${file.size}:${file.lastModified}`,
    );
    if (duplicate) return undefined;
    const id = crypto.randomUUID();
    await saveAudio(id, file);
    const parts = file.name.replace(/\.[^.]+$/, "").split(" - ");
    const track: Track = {
      id,
      title: parts.length > 1 ? parts.slice(1).join(" - ") : parts[0]!,
      artist: parts.length > 1 ? parts[0]! : "未知歌手",
      album: "本地导入",
      duration: 0,
      cover: "/images/night-drive.webp",
      quality: file.name.split(".").pop()!.toUpperCase(),
      color: "#7d85e8",
      lyrics: [],
      source: "local",
      fileName: `${file.name}:${file.size}:${file.lastModified}`,
    };
    state.localTracks.push(track);
    state.queue.push(id);
    return track;
  }

  // 新建歌单时返回编号，供侧边栏立即打开对应详情页。
  function createPlaylist(name: string, trackIds: string[] = []): string {
    const id = crypto.randomUUID();
    state.playlists.push({ id, name: name.trim(), trackIds });
    return id;
  }

  // 删除用户自建歌单，歌曲与本地文件本身保留在音乐库中。
  function deletePlaylist(id: string): void {
    state.playlists = state.playlists.filter((list) => list.id !== id);
    notify("歌单已删除，歌曲仍保留在音乐库中");
  }

  // 静音与恢复使用同一音量状态，播放器各入口保持一致。
  function toggleMute(): void {
    if (state.volume) {
      state.lastVolume = state.volume;
      state.volume = 0;
    } else state.volume = state.lastVolume || 70;
  }

  useEventListener(audio, "play", () => {
    state.playing = true;
  });
  useEventListener(audio, "pause", () => {
    state.playing = false;
  });
  useEventListener(audio, "timeupdate", () => {
    state.time = audio.currentTime;
  });
  useEventListener(audio, "loadedmetadata", () => {
    if (Number.isFinite(audio.duration)) {
      state.duration = audio.duration;
      const track = state.localTracks.find(
        (item) => item.id === state.currentId,
      );
      if (track) track.duration = audio.duration;
    }
  });
  useEventListener(audio, "ended", () => next(true));
  useEventListener(audio, "error", () => {
    if (audio.getAttribute("src") && !state.loading) {
      state.playing = false;
      notify("此音频无法解码，请尝试 MP3、WAV、FLAC 或 OGG 文件", "error");
    }
  });
  watch(
    () => state.volume,
    (value) => {
      audio.volume = Math.max(0, Math.min(100, value)) / 100;
    },
  );
  watch(
    () => state.settings.sleep,
    (value) => {
      sleepEndsAt = value ? Date.now() + value * 60_000 : 0;
    },
  );

  useIntervalFn(() => {
    if (sleepEndsAt && Date.now() >= sleepEndsAt) {
      audio.pause();
      state.playing = false;
      state.settings.sleep = 0;
      sleepEndsAt = 0;
      notify("睡眠定时已结束，播放已暂停");
    }
    if (currentTrack.value.source === "demo" && state.playing) {
      state.time = Math.min(state.duration, state.time + 0.25);
      if (state.time >= state.duration) next(true);
    }
  }, 250);

  // 注册系统媒体控制；本地音频可由系统播放、暂停、切歌与定位。
  function setupMediaSession(): void {
    if (!("mediaSession" in navigator)) return;
    const actions: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        if (!state.playing) void togglePlayback();
      },
      pause: () => {
        if (state.playing) void togglePlayback();
      },
      previoustrack: previous,
      nexttrack: () => next(),
      seekto: (details) => {
        if (details.seekTime !== undefined) seek(details.seekTime);
      },
      seekbackward: () => seek(state.time - 5),
      seekforward: () => seek(state.time + 5),
    };
    for (const [action, handler] of Object.entries(actions)) {
      try {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          handler,
        );
      } catch {
        /* 系统未提供的媒体操作由界面继续处理。 */
      }
    }
    watch(
      currentTrack,
      (track) => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: [
            {
              src: new URL(track.cover, location.href).href,
              sizes: "512x512",
              type: "image/webp",
            },
          ],
        });
      },
      { immediate: true },
    );
    watch(
      () => state.playing,
      (value) => {
        navigator.mediaSession.playbackState = value ? "playing" : "paused";
      },
    );
  }

  // 关闭主播放器时停止音频并释放临时文件 URL。
  function dispose(): void {
    selection++;
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  onScopeDispose(dispose);

  return {
    ...toRefs(state),
    tracks,
    currentTrack,
    albums,
    artists,
    queueTracks,
    liked,
    lyricIndex,
    currentLyric,
    nextTrack,
    playTrack,
    togglePlayback,
    playAll,
    next,
    previous,
    seek,
    toggleLike,
    playNext,
    reorderQueue,
    startRadio,
    importFile,
    createPlaylist,
    deletePlaylist,
    toggleMute,
    setupMediaSession,
  };
});
