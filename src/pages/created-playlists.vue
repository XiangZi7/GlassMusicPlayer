<template>
  <div class="flex-1 overflow-hidden text-primary">
    <div class="h-full overflow-auto p-6">
      <PageSkeleton v-if="state.isPageLoading" :sections="['grid']" :grid-count="6" />
      <template v-else>
        <h1 class="mb-6 text-2xl font-bold text-primary">创建的歌单</h1>
      </template>
    </div>
  </div>
</template>
