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
          path: '/recent',
          name: 'recent',
          component: () => import('@/pages/recent.vue'),
        },
        {
          path: '/likes',
          name: 'likes',
          component: () => import('@/pages/likes.vue'),
        },
        {
          path: '/discover',
          name: 'discover',
          component: () => import('@/pages/discover.vue'),
        },
        {
          path: '/my-music',
          name: 'my-music',
          component: () => import('@/pages/my-music.vue'),
        },
        {
          path: '/search',
          name: 'search',
          component: () => import('@/pages/search.vue'),
        },
        {
          path: '/charts',
          name: 'charts',
          component: () => import('@/pages/charts.vue'),
        },
        {
          path: '/artist/:name',
          name: 'artist',
          component: () => import('@/pages/artist.vue'),
        },
        {
          path: '/song/:id',
          name: 'song',
          component: () => import('@/pages/song.vue'),
        },
        {
          path: '/album/:id',
          name: 'album',
          component: () => import('@/pages/album.vue'),
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
