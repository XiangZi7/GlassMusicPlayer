<script setup lang="ts">
defineProps<{ theme: string; moving: boolean }>()
</script>

<template>
  <div
    class="fs-scenery pointer-events-none absolute inset-0 z-[1] overflow-hidden"
    :data-scene="theme"
    :class="{ moving }"
    aria-hidden="true"
  >
    <i class="shape first" /><i class="shape second" /><i class="shape third" />
  </div>
</template>

<style scoped>
.shape {
  position: absolute;
  display: block;
}
/* 时尚的两道极光从封面后展开，留下右侧的歌词阅读空间。 */
[data-scene='magazine'] {
  background: radial-gradient(
    ellipse at 14% 70%,
    transparent 20%,
    rgb(4 8 22 / 30%) 85%
  );
}
[data-scene='magazine'] .shape {
  inset: -35% -20%;
  background: radial-gradient(
    ellipse 60% 14% at 25% 60%,
    transparent 60%,
    var(--amb2, #86b8de66) 73%,
    transparent 100%
  );
  rotate: -18deg;
  opacity: 0.65;
}
[data-scene='magazine'] .second {
  rotate: -28deg;
  translate: 9% 13%;
  opacity: 0.35;
}
[data-scene='magazine'] .third {
  display: none;
}
/* 手书以深褐纸面、细纸纹和不闭合的墨圈衬托笔画。 */
[data-scene='ink'] {
  background:
    repeating-linear-gradient(
      4deg,
      transparent 0 5px,
      rgb(224 186 121 / 3%) 5px 6px
    ),
    linear-gradient(
      115deg,
      rgb(38 24 21 / 81%),
      rgb(48 39 29 / 85%) 57%,
      rgb(28 21 18 / 92%)
    );
}
[data-scene='ink'] .first,
[data-scene='ink'] .second {
  width: min(48vw, 650px);
  aspect-ratio: 1;
  left: -9%;
  top: 4%;
  rotate: -24deg;
  border-radius: 49% 53% 46% 50%;
  border: clamp(8px, 1.2vw, 18px) solid rgb(208 174 116 / 13%);
  border-right-color: transparent;
  border-bottom-width: 3px;
}
[data-scene='ink'] .second {
  scale: 0.96;
  rotate: -16deg;
  opacity: 0.6;
}
[data-scene='ink'] .third {
  inset: 0 0 0 52%;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 59px,
    rgb(218 182 126 / 6%) 59px 60px
  );
}
/* 字幕舞台将柔蓝投影光束留在两侧，以暗角围出银幕。 */
[data-scene='cinema'] {
  background: radial-gradient(
    ellipse at 50% 53%,
    rgb(24 42 65 / 72%),
    rgb(5 9 18 / 94%) 78%
  );
  box-shadow:
    inset 0 5vh 0 rgb(1 4 10 / 34%),
    inset 0 -5vh 0 rgb(1 4 10 / 34%);
}
[data-scene='cinema'] .first,
[data-scene='cinema'] .second {
  inset: -30% -10%;
  transform-origin: 8% 0;
  background: conic-gradient(
    from 131deg at 8% 0,
    transparent,
    rgb(151 195 232 / 13%) 7deg,
    transparent 16deg
  );
}
[data-scene='cinema'] .second {
  scale: -1 1;
  opacity: 0.65;
}
/* 对话保留封面环境光，背景中零散的圆环、方形与点阵缓慢浮动。 */
[data-scene='chat'] {
  background: linear-gradient(
    140deg,
    rgb(15 30 48 / 40%),
    transparent 52%,
    rgb(12 32 58 / 38%)
  );
}
[data-scene='chat'] .first {
  top: 15%;
  left: 10%;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  border: 2px solid rgb(153 204 242 / 22%);
}
[data-scene='chat'] .second {
  bottom: 24%;
  right: 8%;
  width: 41px;
  height: 41px;
  rotate: 24deg;
  border: 2px solid rgb(173 214 252 / 12%);
}
[data-scene='chat'] .third {
  top: 29%;
  left: 49%;
  width: 36px;
  height: 36px;
  background: radial-gradient(
      circle,
      rgb(185 222 249 / 17%) 1px,
      transparent 2px
    )
    0 0 / 9px 9px;
}
@media (prefers-reduced-motion: no-preference) {
  .moving .shape {
    animation: scenery-drift 22s ease-in-out infinite alternate;
  }
  .moving .second {
    animation-direction: alternate-reverse;
    animation-duration: 29s;
  }
  [data-scene='ink'].moving .first,
  [data-scene='ink'].moving .second {
    animation: ink-turn 13s ease-in-out infinite alternate;
  }
  [data-scene='ink'].moving .second {
    animation-direction: alternate-reverse;
    animation-duration: 17s;
  }
  [data-scene='chat'].moving .shape {
    animation: chat-float 8s ease-in-out infinite alternate;
  }
  [data-scene='chat'].moving .second {
    animation-direction: alternate-reverse;
    animation-duration: 11s;
  }
  [data-scene='chat'].moving .third {
    animation-delay: -4s;
  }
  [data-scene='cinema'].moving .shape {
    animation-name: projector-sweep;
    animation-duration: 24s;
  }
}
@keyframes scenery-drift {
  to {
    transform: translate(12px, -14px);
  }
}
@keyframes ink-turn {
  from {
    transform: rotate(-13deg) translate(-1%, 0);
  }
  to {
    transform: rotate(15deg) translate(3%, -2%);
  }
}
@keyframes chat-float {
  from {
    transform: translate(-12px, 14px) rotate(-8deg);
  }
  to {
    transform: translate(20px, -24px) rotate(12deg);
  }
}
@keyframes projector-sweep {
  to {
    transform: rotate(-5deg);
  }
}
</style>
