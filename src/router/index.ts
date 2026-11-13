import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: () => import("@/layouts/player-layout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/pages/index/index.vue"),
          meta: { title: "首页" },
        },
        {
          path: "search",
          name: "search",
          component: () => import("@/pages/search.vue"),
          meta: { title: "搜索" },
        },
        {
          path: "library/:tab?",
          name: "library",
          component: () => import("@/pages/library.vue"),
          meta: { title: "音乐库" },
        },
        {
          path: "collection/:kind/:id",
          name: "collection",
          component: () => import("@/pages/collection.vue"),
          meta: { title: "歌单" },
        },
        {
          path: "import/:tab?",
          name: "import",
          component: () => import("@/pages/import/index.vue"),
          meta: { title: "内容导入" },
        },
        {
          path: "radio",
          name: "radio",
          component: () => import("@/pages/radio.vue"),
          meta: { title: "歌曲电台" },
        },
        {
          path: "settings",
          name: "settings",
          component: () => import("@/pages/settings.vue"),
          meta: { title: "设置" },
        },
      ],
    },
    { path: "/desktop/:mode", component: () => import("@/pages/desktop.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
