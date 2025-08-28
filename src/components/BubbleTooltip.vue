<script setup lang="ts">
import { computed } from "vue";
import { usePercentageCalculator } from "../composables/usePercentageCalculator";

interface BubbleData {
  _id: string;
  total: number;
  positivo: number;
  neutro: number;
  negativo: number;
  originalWords: string[];
  normalizedWord: string;
}

interface Props {
  visible: boolean;
  x: number;
  y: number;
  data: BubbleData | null;
}

const props = defineProps<Props>();

const { calculatePercentages } = usePercentageCalculator();

const percentages = computed(() => {
  if (!props.data) return null;

  return calculatePercentages({
    positivo: props.data.positivo,
    neutro: props.data.neutro,
    negativo: props.data.negativo,
    total: props.data.total,
  });
});

const tooltipStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}));

const shouldShow = computed(
  () => props.visible && props.data && percentages.value
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shouldShow"
      :style="tooltipStyle"
      class="fixed z-50 p-4 rounded-lg shadow-lg bg-white text-gray-800 border border-gray-300 pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+10px)]"
      role="tooltip"
      aria-live="polite"
    >
      <h3 class="font-bold text-lg mb-2 capitalize">
        {{ data!.originalWords[0] }}
      </h3>

      <p class="mb-1">Total: {{ data!.total }}</p>

      <p class="text-[var(--positive-color)]">
        Positivo: {{ percentages!.positivo }}%
      </p>
      <p class="text-[var(--neutral-color)]">
        Neutro: {{ percentages!.neutro }}%
      </p>
      <p class="text-[var(--negative-color)]">
        Negativo: {{ percentages!.negativo }}%
      </p>
    </div>
  </Teleport>
</template>
