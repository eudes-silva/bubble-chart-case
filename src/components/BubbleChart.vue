<script setup lang="ts">
import { onMounted, onUnmounted, toRef } from "vue";
import BubbleTooltip from "./BubbleTooltip.vue";
import {
  usePixiBubbleChart,
  type BubbleData,
} from "../composables/usePixiBubbleChart";

interface Props {
  data: BubbleData[];
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Visualização de sentimentos em bolhas",
});

const dataRef = toRef(props, "data");
const titleRef = toRef(props, "title");

const { pixiContainerRef, tooltip, reinitialize, initializePixi, destroyPixi } =
  usePixiBubbleChart(dataRef, titleRef);

defineExpose({
  reinitialize,
});

onMounted(() => {
  initializePixi();
});

onUnmounted(() => {
  destroyPixi();
});
</script>

<template>
  <div class="relative w-full h-full flex flex-col items-center justify-start">
    <div
      ref="pixiContainerRef"
      class="w-full h-full"
      style="overflow: hidden; touch-action: none"
    />

    <BubbleTooltip
      :visible="tooltip.visible"
      :x="tooltip.x"
      :y="tooltip.y"
      :data="tooltip.data"
    />
  </div>
</template>
