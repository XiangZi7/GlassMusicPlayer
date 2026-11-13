import { h, render } from "vue";
import PaginationBar from "@/components/ui/PaginationBar.vue";

const hosts = new Set<HTMLElement>();

// 原稿只有一页时隐藏分页，并卸载其 Vue 内容。
export function clearSourcePagination(host: HTMLElement): void {
  render(null, host);
  host.replaceChildren();
  hosts.delete(host);
}

// 原稿分页只替换渲染入口：保留按钮、胶囊、数据钩子与原有翻页事件。
export function renderSourcePagination(
  host: HTMLElement,
  pageKey: string,
  total: number,
  current: number,
  slots: (number | string)[],
): void {
  hosts.add(host);
  render(h(PaginationBar, { pageKey, total, current, slots }), host);
}

// 页面退出时卸载动态分页组件，清理对应的 Vue 渲染实例。
export function clearSourcePaginations(): void {
  for (const host of hosts) render(null, host);
  hosts.clear();
}
