import { createRouter, createWebHashHistory } from 'vue-router'
// 首页和每日推荐详情复用同一组件实例，切换视图时保留当前账号的完整歌单。
const homeDiscovery = () => import('@/pages/index/index.vue')
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
          component: homeDiscovery,
          meta: { playerPage: 'home' },
        },
        {
          path: 'daily',
          name: 'daily',
          component: homeDiscovery,
          props: { detail: true },
          meta: { playerPage: 'daily' },
        },
        {
          path: 'discovery/:platform(netease|kugou|kuwo)/:id',
          name: 'discovery',
          component: () => import('@/pages/discovery.vue'),
          props: true,
          meta: { playerPage: 'discovery' },
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
          path: 'smart',
          name: 'library-smart',
          component: () => import('@/pages/library/smart.vue'),
          meta: { playerPage: 'smart' },
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
    {
      path: '/settings',
      component: () => import('@/pages/settings/index.vue'),
    },
    {
      path: '/desktop/island',
      name: 'desktop-island',
      component: () => import('@/pages/lyric-island.vue'),
    },
    {
      path: '/desktop/tray',
      name: 'desktop-tray',
      component: () => import('@/pages/tray.vue'),
    },
    { path: '/desktop/:mode', component: () => import('@/pages/desktop.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
