import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { notify } from "@/services/notification";

// 执行自定义标题栏的真实窗口操作，浏览器预览时给出统一反馈。
export async function controlWindow(
  action: "minimize" | "maximize" | "close",
): Promise<void> {
  if (!isTauri()) {
    notify("窗口控制在 Tauri 桌面应用中可用");
    return;
  }
  try {
    const window = getCurrentWindow();
    if (action === "maximize") await window.toggleMaximize();
    else await window[action]();
  } catch {
    notify("窗口操作失败，请重试", "error");
  }
}

// 打开置顶的独立桌面歌词窗或迷你播放器，重复点击时聚焦现有窗口。
export async function openDesktop(mode: "lyrics" | "mini"): Promise<void> {
  if (!isTauri()) {
    notify("独立歌词窗和迷你播放器请在 Tauri 桌面应用中打开");
    return;
  }
  try {
    await invoke("open_desktop_window", { kind: mode });
  } catch {
    notify("无法打开桌面窗口，请重试", "error");
  }
}
