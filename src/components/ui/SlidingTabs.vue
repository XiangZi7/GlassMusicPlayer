<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useSlidingPill } from '@/composables/useSlidingPill';
import { usePlayer } from '@/composables/usePlayer';
import type { PlayerPage, SortMode } from '@/stores/player';
const props = defineProps<{options:{label:string;value:string}[];hook:string;kind?:'tabs'|'segment'}>();
const {state,controller}=usePlayer();
const root=useTemplateRef<HTMLElement>('root');
const selected=computed(()=>{
  if(props.hook==='data-sort'){
    const key=props.options[0]?.value.split(':')[0]||'';
    return `${key}:${state.sorts[key]||'def'}`;
  }
  return state.page==='album'?'albums':state.page==='artist'?'artists':state.page;
});
useSlidingPill(root,()=>selected.value,props.hook==='data-sort'?undefined:props.hook);
// 排序更新当前列表；业务标签通过播放器导航进入真实路由。
function select(value:string):void {
  if(props.hook==='data-sort'){
    const [key,mode]=value.split(':');
    if(key&&mode){state.sorts[key]=mode as SortMode;state.pg[key]=1;}
  }else controller()?.navigate(value as PlayerPage);
}
</script>
<template>
  <div ref="root">
    <BaseButton v-for="option in options" :key="option.value" :data-slide-value="option.value" :class="{on:selected===option.value}" :aria-selected="kind!=='segment'?selected===option.value:undefined" :aria-pressed="kind==='segment'?selected===option.value:undefined" @click="select(option.value)">{{option.label}}</BaseButton>
    <span class="tab-pill" :class="{'seg-pill':kind==='segment'}" data-slide-pill aria-hidden="true"/>
  </div>
</template>
