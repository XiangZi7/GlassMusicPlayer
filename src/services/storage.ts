import { invoke, isTauri } from '@tauri-apps/api/core'
import type { MusicPlatform } from '@/api'
import type { SourceTrack } from '@/types/prototype'
import { apiBaseUrl } from '@/utils/http'

export type StorageDirectoryKind = 'cache' | 'download'

export interface StorageConfig {
  cacheDirectory: string
  downloadDirectory: string
}

export interface StorageInfo extends StorageConfig {
  supported: true
  audioCacheDirectory: string
  cacheBytes: number
  cacheFiles: number
  downloadBytes: number
  downloadCount: number
}

export interface DownloadedTrack {
  key: string
  platform: MusicPlatform
  id: string
  title: string
  artist: string
  album: string
  fileName: string
  path: string
  bytes: number
  downloadedAt: number
  status: 'full' | 'preview' | 'unknown'
  quality: string | null
}

export interface CacheClearResult {
  removedFiles: number
  removedBytes: number
}

// 浏览器预览不具备原生文件系统，调用方可据此禁用目录与下载入口。
export function isNativeStorageSupported(): boolean {
  return isTauri()
}

// 原生操作统一转换可读错误；通知仍由页面负责，避免重复反馈。
async function storageCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri())
    throw new Error('浏览器预览不支持原生目录与歌曲下载，请使用桌面版本。')
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : '原生存储操作失败。')
  }
}

// 读取持久目录配置及本应用音频缓存、已登记下载的实际统计。
export function getStorageInfo(): Promise<StorageInfo> {
  return storageCommand('get_storage_info')
}

// 只更新提供的目录字段；旧缓存、歌单、账户和已有下载不会迁移或删除。
export function updateStorageConfig(
  config: Partial<StorageConfig>
): Promise<StorageInfo> {
  return storageCommand('update_storage_config', { config })
}

// 打开系统文件夹选择器，取消返回 null；选择后由调用方明确提交配置。
export function chooseStorageDirectory(
  kind: StorageDirectoryKind
): Promise<string | null> {
  return storageCommand('choose_storage_directory', { kind })
}

// 使用系统文件管理器打开实际目录，不拼接 shell 命令。
export function openStorageDirectory(
  kind: StorageDirectoryKind
): Promise<void> {
  return storageCommand('open_storage_directory', { kind })
}

// 仅清理固定自有子目录中的已识别缓存文件，不递归删除选择的目录。
export function clearAudioCache(): Promise<CacheClearResult> {
  return storageCommand('clear_audio_cache')
}

// 只列出元数据与实际文件均通过校验的下载，不把缺失文件当作完成。
export function listDownloads(): Promise<DownloadedTrack[]> {
  return storageCommand('list_downloads')
}

// 使用当前配置后端下载平台实际允许的音频。
export function downloadCatalogTrack(
  track: SourceTrack,
  options: { quality?: string } = {}
): Promise<DownloadedTrack> {
  if (!track.catalog)
    return Promise.reject(new Error('此曲目没有可下载的音源。'))
  return storageCommand('download_catalog_track', {
    input: {
      apiBaseUrl,
      platform: track.catalog.platform,
      id: track.catalog.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      quality: options.quality ?? null,
    },
  })
}
