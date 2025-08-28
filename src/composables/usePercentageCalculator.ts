import { computed, type Ref } from "vue";

export interface SentimentData {
  positivo: number;
  neutro: number;
  negativo: number;
  total: number;
}

export interface PercentageResult {
  positivo: number;
  neutro: number;
  negativo: number;
}

export function usePercentageCalculator() {
  const calculatePercentages = (data: SentimentData): PercentageResult => {
    const { positivo, neutro, negativo, total } = data;

    if (total === 0) {
      return { positivo: 0, neutro: 0, negativo: 0 };
    }

    const exact = {
      positivo: (positivo / total) * 100,
      neutro: (neutro / total) * 100,
      negativo: (negativo / total) * 100,
    };

    const rounded = {
      positivo: Math.round(exact.positivo),
      neutro: Math.round(exact.neutro),
      negativo: Math.round(exact.negativo),
    };

    const totalRounded = Object.values(rounded).reduce(
      (sum, val) => sum + val,
      0
    );
    const error = 100 - totalRounded;

    if (error === 0) {
      return rounded;
    }

    const adjustments = [
      {
        key: "positivo" as const,
        exact: exact.positivo,
        rounded: rounded.positivo,
      },
      { key: "neutro" as const, exact: exact.neutro, rounded: rounded.neutro },
      {
        key: "negativo" as const,
        exact: exact.negativo,
        rounded: rounded.negativo,
      },
    ].sort((a, b) => {
      const diffA = Math.abs(a.exact - a.rounded);
      const diffB = Math.abs(b.exact - b.rounded);
      return diffB - diffA;
    });

    const keyToAdjust = adjustments[0].key;
    rounded[keyToAdjust] += error > 0 ? 1 : -1;

    const finalSum = Object.values(rounded).reduce((sum, val) => sum + val, 0);
    if (finalSum !== 100) {
      rounded.negativo += 100 - finalSum;
    }

    return rounded;
  };

  const createPercentageCalculator = (dataRef: Ref<SentimentData | null>) => {
    return computed(() => {
      if (!dataRef.value) return null;
      return calculatePercentages(dataRef.value);
    });
  };

  return {
    calculatePercentages,
    createPercentageCalculator,
  };
}
