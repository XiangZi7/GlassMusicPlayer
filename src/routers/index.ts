import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { defineComponent, h, defineAsyncComponent } from 'vue'
import { useMediaQuery } from '@vueuse/core'

const mode = import.meta.env.VITE_ROUTER_MODE

const routerMode = {
  hash: () => createWebHashHistory(),
  history: () => createWebHistory(),
}

// 响应式组件工厂：根据窗口宽度在桌面端与移动端组件之间切换
// desktopLoader 与 mobileLoader 为对应组件的动态导入函数
const responsive = (desktopLoader: () => Promise<any>, mobileLoader: () => Promise<any>) =>
  defineComponent({
    name: 'ResponsiveRouteComponent',
    setup() {
      // 使用媒体查询监听窗口是否为移动端尺寸（阈值 768px）
      const isMobile = useMediaQuery('(max-width: 768px)')
      // 异步组件定义，按需加载对应端的页面组件
      const Desktop = defineAsyncComponent(desktopLoader)
      const Mobile = defineAsyncComponent(mobileLoader)
      return () => h(isMobile.value ? Mobile : Desktop)
    },
  })

const router = createRouter({
  history: routerMode[mode](),
  strict: false,
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes: [
    {
      path: '/',
      // 布局层：根据尺寸切换桌面与移动端布局
      component: responsive(
        () => import('@/layout/index.vue'),
        () => import('@/layout/mobile/index.vue')
      ),
      children: [
        {
          path: '/',
          name: 'home',
          component: responsive(
            () => import('@/pages/index.vue'),
            () => import('@/pages/mobile/index.vue')
          ),
        },
        {
          path: '/playlist/:id',
          name: 'playlist',
          component: responsive(
            () => import('@/pages/playlist.vue'),
            () => import('@/pages/mobile/playlist.vue')
          ),
        },
        {
          path: '/mv-list',
          name: 'mv-list',
          component: responsive(
            () => import('@/pages/mv-list.vue'),
            () => import('@/pages/mobile/mv-list.vue')
          ),
        },
        {
          path: '/mv-player/:id',
          name: 'mv-player',
          component: responsive(
            () => import('@/pages/mv-player.vue'),
            () => import('@/pages/mobile/mv-player.vue')
          ),
        },
        {
          path: '/recent',
          name: 'recent',
          component: responsive(
            () => import('@/pages/recent.vue'),
            () => import('@/pages/mobile/recent.vue')
          ),
        },
        {
          path: '/my-music',
          name: 'my-music',
          component: responsive(
            () => import('@/pages/my-music.vue'),
            () => import('@/pages/mobile/recent.vue')
          ),
        },
        {
          path: '/likes',
          name: 'likes',
          component: responsive(
            () => import('@/pages/likes.vue'),
            () => import('@/pages/mobile/likes.vue')
          ),
        },
        {
          path: '/search',
          name: 'search',
          component: responsive(
            () => import('@/pages/search.vue'),
            () => import('@/pages/mobile/search.vue')
          ),
        },
        {
          path: '/charts',
          name: 'charts',
          component: responsive(
            () => import('@/pages/charts.vue'),
            () => import('@/pages/mobile/charts.vue')
          ),
        },
        {
          path: '/artists',
          name: 'artists',
          component: responsive(
            () => import('@/pages/artists.vue'),
            () => import('@/pages/artists.vue')
          ),
        },
        {
          path: '/new-albums',
          name: 'new-albums',
          component: responsive(
            () => import('@/pages/new-albums.vue'),
            () => import('@/pages/new-albums.vue')
          ),
        },
        {
          path: '/artist/:id',
          name: 'artist',
          component: responsive(
            () => import('@/pages/artist.vue'),
            () => import('@/pages/mobile/artist.vue')
          ),
        },
        {
          path: '/song/:id',
          name: 'song',
          component: responsive(
            () => import('@/pages/song.vue'),
            () => import('@/pages/mobile/song.vue')
          ),
        },
        {
          path: '/album/:id',
          name: 'album',
          component: responsive(
            () => import('@/pages/album.vue'),
            () => import('@/pages/mobile/album.vue')
          ),
        },
        {
          path: '/local-music',
          name: 'local-music',
          component: responsive(
            () => import('@/pages/local-music.vue'),
            () => import('@/pages/mobile/local-music.vue')
          ),
        },
        {
          path: '/settings',
          name: 'settings',
          component: responsive(
            () => import('@/pages/settings.vue'),
            () => import('@/pages/mobile/settings.vue')
          ),
        },
      ],
    },
  ],
})
export default router
