import { createRouter, createWebHashHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/player-layout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/index/index.vue'),
          meta: { playerPage: 'home' },
        },
        {
          path: 'search',
          component: () => import('@/pages/search.vue'),
          meta: { playerPage: 'search' },
        },
        {
          path: 'library',
          component: () => import('@/pages/library/index.vue'),
          meta: { playerPage: 'library' },
        },
        {
          path: 'albums',
          component: () => import('@/pages/albums.vue'),
          meta: { playerPage: 'albums' },
        },
        {
          path: 'artists',
          component: () => import('@/pages/artists.vue'),
          meta: { playerPage: 'artists' },
        },
        {
          path: 'album',
          component: () => import('@/pages/album.vue'),
          meta: { playerPage: 'album' },
        },
        {
          path: 'artist',
          component: () => import('@/pages/artist.vue'),
          meta: { playerPage: 'artist' },
        },
        {
          path: 'liked',
          component: () => import('@/pages/liked.vue'),
          meta: { playerPage: 'liked' },
        },
        {
          path: 'recent',
          component: () => import('@/pages/recent.vue'),
          meta: { playerPage: 'recent' },
        },
        {
          path: 'playlist',
          component: () => import('@/pages/playlist.vue'),
          meta: { playerPage: 'playlist' },
        },
        {
          path: 'radio',
          component: () => import('@/pages/radio.vue'),
          meta: { playerPage: 'radio' },
        },
        {
          path: 'settings',
          component: () => import('@/pages/settings.vue'),
          meta: { playerPage: 'settings' },
        },
        {
          path: 'connect',
          component: () => import('@/pages/connect.vue'),
          meta: { playerPage: 'connect' },
        },
        {
          path: 'upload',
          component: () => import('@/pages/upload.vue'),
          meta: { playerPage: 'upload' },
        },
        {
          path: 'downloads',
          component: () => import('@/pages/downloads.vue'),
          meta: { playerPage: 'downloads' },
        },
        {
          path: 'hub',
          component: () => import('@/pages/hub.vue'),
          meta: { playerPage: 'hub' },
        },
      ],
    },
    { path: '/desktop/:mode', component: () => import('@/pages/desktop.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
