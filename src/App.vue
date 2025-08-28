<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4"
  >
    <div v-if="loading" class="text-gray-700 text-lg font-semibold">
      Carregando dados...
    </div>
    <div
      v-else-if="error"
      class="text-red-600 text-lg font-semibold text-center"
    >
      Erro ao carregar os dados: {{ error }}
    </div>
    <div v-else class="w-full max-w-6xl h-[80vh]">
      <BubbleChart :data="chartData" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Ref } from "vue";
import BubbleChart from "./components/BubbleChart.vue";
import axios from "axios";

interface ChartDataItem {
  _id: string;
  total: number;
  positivo: number;
  neutro: number;
  negativo: number;
  percentPositivo: number;
  percentNeutro: number;
  percentNegativo: number;
  originalWords: string[];
  normalizedWord: string;
}

const chartData: Ref<ChartDataItem[]> = ref([]);
const loading = ref(true);
const error = ref<string | null>(null);

const fetchData = async () => {
  try {
    const response = await axios.get("/data/sentiment_data_json.json");

    const data = response.data;
    chartData.value = data;

    console.log("Dados carregados com sucesso:", chartData.value);
  } catch (e: any) {
    console.error("Erro na requisição Axios:", e);
    if (e.response) {
      error.value = `Erro ao carregar os dados: ${e.response.status} - ${e.response.statusText}. Por favor, verifique se o arquivo sentiment_data_json.json está no caminho correto.`;
    } else if (e.request) {
      error.value =
        "Erro na requisição: Não foi possível obter uma resposta do servidor. Verifique sua conexão ou o servidor de desenvolvimento.";
    } else {
      error.value = `Ocorreu um erro desconhecido: ${e.message}`;
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>
