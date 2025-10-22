import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

const mode = import.meta.env.VITE_ROUTER_MODE

const routerMode = {
  hash: () => createWebHashHistory(),
  history: () => createWebHistory(),
}

const router = createRouter({
  history: routerMode[mode](),
  strict: false,
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('@/layout/index.vue'),
      children: [
        {
          path: '/',
          name: 'home',
          component: () => import('@/pages/index.vue'),
        },
        {
          path: '/playlist/:id',
          name: 'playlist',
          component: () => import('@/pages/playlist.vue'),
        },
      ],
    },
  ],
})
export default router
