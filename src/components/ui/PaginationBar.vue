<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useSlidingPill } from '@/composables/useSlidingPill';
const props = defineProps<{ pageKey: string; total: number; slots?: (number | string)[] }>();
const current = defineModel<number>('current', {default:1});
const root = useTemplateRef<HTMLElement>('root');
const pages = computed(() => Math.ceil(props.total / 10));
const slots = computed(() => {
  const count=pages.value, value=current.value;
  if(count<=7)return Array.from({length:count},(_,index)=>index+1);
  if(value<=4)return [1,2,3,4,5,'…',count];
  if(value>=count-3)return [1,'…',count-4,count-3,count-2,count-1,count];
  return [1,'…',value-1,value,value+1,'…',count];
});
useSlidingPill(root, () => String(current.value));
// 页码更新保留胶囊节点，供原稿 CSS 过渡从当前位置继续。
function go(page:number):void {current.value=Math.max(1,Math.min(pages.value,page));}
</script>
<template>
  <div v-show="pages>1" ref="root" class="pager" :data-vue-pager="pageKey" aria-label="歌曲分页">
    <BaseButton class="pg-btn" :disabled="current<=1" aria-label="上一页" @click="go(current-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg></BaseButton>
    <template v-for="(page,index) in slots" :key="index">
      <span v-if="page==='…'" class="pg-ellipsis" aria-hidden="true">…</span>
      <BaseButton v-else class="pg-btn" :class="{on:page===current}" :data-slide-value="String(page)" :aria-label="'第 '+page+' 页'" :aria-current="page===current?'page':undefined" @click="go(Number(page))">{{page}}</BaseButton>
    </template>
    <BaseButton class="pg-btn" :disabled="current>=pages" aria-label="下一页" @click="go(current+1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg></BaseButton>
    <span class="pg-total">共 {{total}} 首</span><span class="pg-pill" data-slide-pill aria-hidden="true"/>
  </div>
</template>
