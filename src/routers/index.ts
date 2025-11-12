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
        {
          path: '/mv-list',
          name: 'mv-list',
          component: () => import('@/pages/mv-list.vue'),
        },
        {
          path: '/mv-player/:id',
          name: 'mv-player',
          component: () => import('@/pages/mv-player.vue'),
        },
        {
          path: '/settings',
          name: 'settings',
          component: () => import('@/pages/settings.vue'),
        },
      ],
    },
  ],
})
export default router
