import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/pages/index/index.vue"),
    },
    { path: "/desktop/:mode", component: () => import("@/pages/desktop.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
