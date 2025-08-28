# Bubble Chart Case

Visualização de dados em formato de "bolhas" que representa análise de sentimentos de palavras-chave, onde cada bolha tem tamanho dinâmico baseado no volume total de menções e cores que representam a distribuição de sentimentos (positivo, neutro, negativo).

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi desenvolvido utilizando as seguintes tecnologias e bibliotecas:

- **Vue 3:** Framework reativo para a construção da interface do usuário.
- **TypeScript:** Superset do JavaScript que adiciona tipagem estática, melhorando a segurança e a manutenibilidade do código.
- **Vite:** Ferramenta de build extremamente rápida que oferece um ambiente de desenvolvimento ágil.
- **Tailwind CSS:** Framework CSS utilitário que permite a criação de designs customizados de forma rápida.
- **PixiJS:** Biblioteca utilizada para a renderização de gráficos de bolhas, ideal para a criação de elementos visuais performáticos.
- **pnpm:** Gerenciador de pacotes rápido e eficiente, que otimiza o uso de espaço em disco.
- **Axios:** Cliente HTTP baseado em Promise para fazer requisições a APIs.

---

## 🚀 Como Rodar Localmente

Para executar este projeto em sua máquina, siga os passos abaixo:

1.  **Clone o repositório:**

    ```bash
    git clone [https://github.com/eudes-silva/bubble-chart-case.git](https://github.com/eudes-silva/bubble-chart-case.git)
    cd bubble-chart-case
    ```

2.  **Instale as dependências:**

    ```bash
    pnpm install
    ```

3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    pnpm dev
    ```

O projeto estará disponível em `http://localhost:5173` (ou outra porta, dependendo da configuração).

---

## 🔗 Demo Online

[Link para a demo do projeto](https://bubble-chart-case.vercel.app/)

---

## 🧩 Desafios e Soluções

- **[Desafio]** Utilizar a ferramenta correta para renderizar o gráfico de bolhas e calcular a física de colisão e repulsão entre as bolhas

  - **Solução:** Uso da PixiJS, uma biblioteca JavaScript 2D de renderização rápida e leve, focada em performance para criar gráficos interativos na web. Utiliza WebGL por padrão, com fallback para Canvas 2D.
    Utilização do algoritmo Quadtree para cálculos de colisão e repulsão. (performance muito boa para grande quantidade de bolhas)
