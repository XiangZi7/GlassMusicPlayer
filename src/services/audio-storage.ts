let database: Promise<IDBDatabase> | undefined;

// 按需打开本地音频库，使用 IndexedDB 保存用户导入的音频文件。
function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("mirai-music", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("audio");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  });
  return database;
}

// 导入时保存原始音频，确保下次打开应用仍能读取和播放。
export async function saveAudio(id: string, file: File): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite");
    transaction.objectStore("audio").put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// 播放本地歌曲时读取音频二进制，缺少文件时由调用方提示重新导入。
export async function readAudio(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("audio", "readonly")
      .objectStore("audio")
      .get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
