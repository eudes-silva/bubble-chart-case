import { ref, type Ref } from "vue";
import * as PIXI from "pixi.js";
import { usePercentageCalculator } from "./usePercentageCalculator";

export interface BubbleData {
  _id: string;
  total: number;
  positivo: number;
  neutro: number;
  negativo: number;
  originalWords: string[];
  normalizedWord: string;
}

export interface BubbleContainer extends PIXI.Container {
  id: string;
  vx: number;
  vy: number;
  radius: number;
  data: BubbleData;
  graphics: PIXI.Graphics;
  text: PIXI.Text;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: BubbleData | null;
}

const RESPONSIVE_CONFIG = {
  scale: {
    breakpoints: [480, 640, 768, 1024, 1280, 1600],
    values: [1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 2.0],
  },
  titleSize: {
    breakpoints: [480, 640, 768, 1024, 1280],
    values: [16, 20, 24, 28, 32, 36],
  },
};

const PHYSICS_CONFIG = {
  damping: 0.85,
  desiredSpacing: 25,
  attractionForce: 0.002,
  repulsionMultiplier: 0.1,
  bounceMultiplier: -1,
  shadowOffset: 2,
  largeBubbleThreshold: 0.7,
  centerZoneRadius: 150,
  strongCenterForce: 0.01,
} as const;

export function usePixiBubbleChart(
  data: Ref<BubbleData[]>,
  title: Ref<string>
) {
  const pixiContainerRef = ref<HTMLDivElement | null>(null);
  const bubbleContainers = ref<BubbleContainer[]>([]);
  const activeBubble = ref<BubbleContainer | null>(null);

  let pixiApp: PIXI.Application | null = null;
  let currentTitleText: PIXI.Text | null = null;

  const { calculatePercentages } = usePercentageCalculator();

  const tooltip = ref<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const getResponsiveValue = (
    width: number,
    config: typeof RESPONSIVE_CONFIG.scale
  ): number => {
    const index = config.breakpoints.findIndex((bp) => width < bp);
    return index === -1
      ? config.values[config.values.length - 1]
      : config.values[index];
  };

  const getResponsiveScaleFactor = (canvasWidth: number): number =>
    getResponsiveValue(canvasWidth, RESPONSIVE_CONFIG.scale);

  const getResponsiveTitleSize = (canvasWidth: number): number =>
    getResponsiveValue(canvasWidth, RESPONSIVE_CONFIG.titleSize);

  const radiusFromTotal = (total: number, canvasWidth: number): number => {
    const scaleFactor = getResponsiveScaleFactor(canvasWidth);
    return Math.max(15 * scaleFactor, Math.sqrt(total) * 6 * scaleFactor);
  };

  const getTitlePosition = (canvasHeight: number): number =>
    canvasHeight * 0.05;

  const resizeCanvas = () => {
    if (!pixiApp || !pixiContainerRef.value) return;

    const parentWidth = pixiContainerRef.value.clientWidth;
    const parentHeight = pixiContainerRef.value.clientHeight;

    pixiApp.renderer.resize(parentWidth, parentHeight);
    pixiApp.canvas.style.width = `${parentWidth}px`;
    pixiApp.canvas.style.height = `${parentHeight}px`;

    requestAnimationFrame(() => {
      initializeBubbles();
    });
  };

  const drawBubble = (
    g: PIXI.Graphics,
    bubbleData: BubbleData,
    canvasWidth: number
  ) => {
    g.clear();
    const radius = radiusFromTotal(bubbleData.total, canvasWidth);
    const scaleFactor = getResponsiveScaleFactor(canvasWidth);
    const donutThickness = Math.max(
      4 * scaleFactor,
      Math.min(8 * scaleFactor, radius * 0.1)
    );
    const outerRadius = radius;
    const innerRadius = radius - donutThickness;

    g.circle(
      PHYSICS_CONFIG.shadowOffset,
      PHYSICS_CONFIG.shadowOffset,
      outerRadius
    );
    g.fill({ color: 0x000000, alpha: 0.15 });

    let currentAngle = -Math.PI / 2;
    const percentages = calculatePercentages({
      positivo: bubbleData.positivo,
      neutro: bubbleData.neutro,
      negativo: bubbleData.negativo,
      total: bubbleData.total,
    });

    const slices = [
      { percentage: percentages.positivo, color: 0x4caf50 },
      { percentage: percentages.neutro, color: 0xe6ac00 },
      { percentage: percentages.negativo, color: 0xf44336 },
    ];

    slices.forEach((slice) => {
      if (slice.percentage > 0) {
        const angle = (slice.percentage / 100) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, outerRadius, currentAngle, currentAngle + angle);
        g.closePath();
        g.fill({ color: slice.color });
        currentAngle += angle;
      }
    });

    g.circle(0, 0, innerRadius);
    g.fill({ color: 0xffffff });
    g.stroke({ width: 1, color: 0xcccccc });
  };

  const createBubbleText = (
    bubbleData: BubbleData,
    radius: number,
    canvasWidth: number
  ): PIXI.Text => {
    const scaleFactor = getResponsiveScaleFactor(canvasWidth);
    const maxFontSize = Math.max(
      8 * scaleFactor,
      Math.min(18 * scaleFactor, radius * 0.4)
    );
    const padding = radius * 0.2;
    const maxTextWidth = (radius - padding) * 2;

    const text = new PIXI.Text({
      text: bubbleData._id,
      style: {
        fontSize: maxFontSize,
        fill: 0x000000,
        fontWeight: "bold",
        wordWrap: true,
        wordWrapWidth: maxTextWidth,
        breakWords: true,
        align: "center",
        fontFamily: "Arial, sans-serif",
      } as PIXI.TextStyle,
    });

    text.anchor.set(0.5);
    return text;
  };

  interface Bubble {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    data?: BubbleData;
  }

  interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  class QuadTree {
    private boundary: Rectangle;
    private capacity: number;
    private maxDepth: number;
    private currentDepth: number;
    private bubbles: Bubble[] = [];
    private divided = false;
    private northeast?: QuadTree;
    private northwest?: QuadTree;
    private southeast?: QuadTree;
    private southwest?: QuadTree;

    constructor(
      boundary: Rectangle,
      capacity = 100,
      maxDepth = 10,
      currentDepth = 0
    ) {
      this.boundary = boundary;
      this.capacity = capacity;
      this.maxDepth = maxDepth;
      this.currentDepth = currentDepth;
    }

    insert(bubble: Bubble): boolean {
      if (!this.contains(bubble)) return false;

      if (!this.divided && this.bubbles.length < this.capacity) {
        this.bubbles.push(bubble);
        return true;
      }

      if (this.currentDepth >= this.maxDepth) {
        this.bubbles.push(bubble);
        return true;
      }

      if (!this.divided) {
        this.subdivide();
      }

      return (
        this.northeast!.insert(bubble) ||
        this.northwest!.insert(bubble) ||
        this.southeast!.insert(bubble) ||
        this.southwest!.insert(bubble) ||
        (this.bubbles.push(bubble), true)
      );
    }

    clear(): void {
      this.bubbles = [];
      this.divided = false;
      this.northeast =
        this.northwest =
        this.southeast =
        this.southwest =
          undefined;
    }

    private contains(bubble: Bubble): boolean {
      return (
        bubble.x + bubble.radius >= this.boundary.x &&
        bubble.x - bubble.radius < this.boundary.x + this.boundary.width &&
        bubble.y + bubble.radius >= this.boundary.y &&
        bubble.y - bubble.radius < this.boundary.y + this.boundary.height
      );
    }

    private subdivide(): void {
      const { x, y, width, height } = this.boundary;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const nextDepth = this.currentDepth + 1;

      this.northeast = new QuadTree(
        { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        nextDepth
      );
      this.northwest = new QuadTree(
        { x, y, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        nextDepth
      );
      this.southeast = new QuadTree(
        {
          x: x + halfWidth,
          y: y + halfHeight,
          width: halfWidth,
          height: halfHeight,
        },
        this.capacity,
        this.maxDepth,
        nextDepth
      );
      this.southwest = new QuadTree(
        { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        nextDepth
      );

      this.divided = true;

      const oldBubbles = [...this.bubbles];
      this.bubbles = [];

      for (const bubble of oldBubbles) {
        if (!this.insert(bubble)) {
          this.bubbles.push(bubble);
        }
      }
    }

    queryRange(range: Rectangle): Bubble[] {
      const found: Bubble[] = [];

      if (!this.intersects(range)) return found;

      for (const bubble of this.bubbles) {
        if (
          bubble.x - bubble.radius < range.x + range.width &&
          bubble.x + bubble.radius > range.x &&
          bubble.y - bubble.radius < range.y + range.height &&
          bubble.y + bubble.radius > range.y
        ) {
          found.push(bubble);
        }
      }

      if (this.divided) {
        found.push(
          ...this.northeast!.queryRange(range),
          ...this.northwest!.queryRange(range),
          ...this.southeast!.queryRange(range),
          ...this.southwest!.queryRange(range)
        );
      }

      return found;
    }

    private intersects(range: Rectangle): boolean {
      return !(
        range.x > this.boundary.x + this.boundary.width ||
        range.x + range.width < this.boundary.x ||
        range.y > this.boundary.y + this.boundary.height ||
        range.y + range.height < this.boundary.y
      );
    }
  }

  let physicsManagerCache: PhysicsManager | null = null;
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;
  let lastTitleHeight = 0;

  class PhysicsManager {
    public canvasWidth: number;
    public canvasHeight: number;
    private topBoundary: number;
    private centerX: number;
    private centerY: number;
    private quadTree: QuadTree;
    private maxBubbleSize: number;

    constructor(
      canvasWidth: number,
      canvasHeight: number,
      titleHeight: number
    ) {
      this.canvasWidth = canvasWidth;
      this.canvasHeight = canvasHeight;
      this.topBoundary = titleHeight;
      this.centerX = canvasWidth / 2;
      this.centerY = titleHeight + (canvasHeight - titleHeight) * 0.4;
      this.maxBubbleSize = 0;

      this.quadTree = new QuadTree({
        x: 0,
        y: titleHeight,
        width: canvasWidth,
        height: canvasHeight - titleHeight,
      });
    }

    private updateBubblePhysics(bubble: Bubble & { data?: BubbleData }): void {
      bubble.vx *= PHYSICS_CONFIG.damping;
      bubble.vy *= PHYSICS_CONFIG.damping;

      const sizeRatio = bubble.radius / (this.maxBubbleSize || bubble.radius);
      const isLargeBubble = sizeRatio >= PHYSICS_CONFIG.largeBubbleThreshold;

      bubble.x += bubble.vx;
      bubble.y += bubble.vy;

      if (
        bubble.x + bubble.radius > this.canvasWidth ||
        bubble.x - bubble.radius < 0
      ) {
        bubble.vx *= PHYSICS_CONFIG.bounceMultiplier;
        bubble.x = Math.max(
          bubble.radius,
          Math.min(this.canvasWidth - bubble.radius, bubble.x)
        );
      }

      const minY = this.topBoundary + bubble.radius;
      const maxY = this.canvasHeight - bubble.radius;

      if (
        bubble.y + bubble.radius > this.canvasHeight ||
        bubble.y - bubble.radius < minY
      ) {
        bubble.vy *= PHYSICS_CONFIG.bounceMultiplier;
        bubble.y = Math.max(minY, Math.min(maxY, bubble.y));
      }

      const dxToCenter = this.centerX - bubble.x;
      const dyToCenter = this.centerY - bubble.y;
      const distanceToCenter = Math.sqrt(
        dxToCenter * dxToCenter + dyToCenter * dyToCenter
      );

      if (isLargeBubble) {
        const centerForce = PHYSICS_CONFIG.strongCenterForce;

        if (distanceToCenter > PHYSICS_CONFIG.centerZoneRadius) {
          const escapeForce =
            (distanceToCenter - PHYSICS_CONFIG.centerZoneRadius) * 0.0001;
          bubble.vx += dxToCenter * (centerForce + escapeForce);
          bubble.vy += dyToCenter * (centerForce + escapeForce);
        } else {
          bubble.vx += dxToCenter * centerForce;
          bubble.vy += dyToCenter * centerForce;
        }
      } else {
        const baseAttractionForce = PHYSICS_CONFIG.attractionForce;
        bubble.vx += dxToCenter * baseAttractionForce;
        bubble.vy += dyToCenter * baseAttractionForce;
      }
    }

    private handleBubbleCollision(bubbleA: Bubble, bubbleB: Bubble): void {
      const dx = bubbleB.x - bubbleA.x;
      const dy = bubbleB.y - bubbleA.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance =
        bubbleA.radius + bubbleB.radius + PHYSICS_CONFIG.desiredSpacing;

      if (distance < minDistance && distance > 0) {
        const overlap = minDistance - distance;
        const angle = Math.atan2(dy, dx);
        const repulsionForce = overlap * PHYSICS_CONFIG.repulsionMultiplier;

        const repulsionVx = Math.cos(angle) * repulsionForce;
        const repulsionVy = Math.sin(angle) * repulsionForce;

        bubbleA.vx -= repulsionVx;
        bubbleA.vy -= repulsionVy;
        bubbleB.vx += repulsionVx;
        bubbleB.vy += repulsionVy;
      }
    }

    updatePhysics(bubbles: Bubble[]): void {
      this.maxBubbleSize = Math.max(...bubbles.map((b) => b.radius));

      bubbles.forEach((bubble) => this.updateBubblePhysics(bubble));

      this.quadTree.clear();
      bubbles.forEach((bubble) => this.quadTree.insert(bubble));

      const processedPairs = new Set<string>();

      for (const bubble of bubbles) {
        const searchRadius = bubble.radius * 3;
        const nearbyBubbles = this.quadTree.queryRange({
          x: bubble.x - searchRadius,
          y: bubble.y - searchRadius,
          width: searchRadius * 2,
          height: searchRadius * 2,
        });

        for (const nearbyBubble of nearbyBubbles) {
          if (nearbyBubble.id !== bubble.id) {
            const pairKey = [bubble.id, nearbyBubble.id].sort().join("-");
            if (!processedPairs.has(pairKey)) {
              this.handleBubbleCollision(bubble, nearbyBubble);
              processedPairs.add(pairKey);
            }
          }
        }
      }
    }
  }

  const updatePhysics = (): void => {
    if (!pixiApp) return;

    const canvasWidth = pixiApp.renderer.width;
    const canvasHeight = pixiApp.renderer.height;
    const actualTitleHeight = currentTitleText
      ? currentTitleText.height + currentTitleText.y
      : getTitlePosition(canvasHeight) * 2;

    if (
      !physicsManagerCache ||
      lastCanvasWidth !== canvasWidth ||
      lastCanvasHeight !== canvasHeight ||
      lastTitleHeight !== actualTitleHeight
    ) {
      physicsManagerCache = new PhysicsManager(
        canvasWidth,
        canvasHeight,
        actualTitleHeight
      );
      lastCanvasWidth = canvasWidth;
      lastCanvasHeight = canvasHeight;
      lastTitleHeight = actualTitleHeight;
    }

    physicsManagerCache.updatePhysics(bubbleContainers.value);

    if (activeBubble.value && pixiApp) {
      const rect = pixiApp.canvas.getBoundingClientRect();
      tooltip.value = {
        visible: true,
        x: rect.left + activeBubble.value.x,
        y: rect.top + activeBubble.value.y - activeBubble.value.radius - 10,
        data: activeBubble.value.data,
      };
    } else {
      tooltip.value.visible = false;
    }
  };

  const onPointerOver = (
    _event: PIXI.FederatedPointerEvent,
    container: BubbleContainer
  ) => {
    activeBubble.value = container;
  };

  const onPointerOut = () => {
    activeBubble.value = null;
  };

  const initializeBubbles = () => {
    if (!pixiApp) {
      console.warn("PIXI Application not ready yet");
      return;
    }

    pixiApp.stage.removeChildren();
    bubbleContainers.value = [];

    const canvasWidth = pixiApp.renderer.width;
    const canvasHeight = pixiApp.renderer.height;
    const centerX = canvasWidth / 2;

    const titleFontSize = getResponsiveTitleSize(canvasWidth);
    const titlePosition = getTitlePosition(canvasHeight);

    if (currentTitleText) {
      currentTitleText.text = title.value;
      (currentTitleText.style as PIXI.TextStyle).fontSize = titleFontSize;
      (currentTitleText.style as PIXI.TextStyle).wordWrapWidth =
        canvasWidth * 0.9;
    } else {
      currentTitleText = new PIXI.Text({
        text: title.value,
        style: {
          fontSize: titleFontSize,
          fill: 0x333333,
          fontWeight: "bold",
          wordWrap: true,
          wordWrapWidth: canvasWidth * 0.9,
          align: "center",
          fontFamily: "Arial, sans-serif",
        } as PIXI.TextStyle,
      });
    }

    currentTitleText.anchor.set(0.5);
    currentTitleText.x = centerX;
    currentTitleText.y = titlePosition;
    pixiApp.stage.addChild(currentTitleText);

    const titleMarginBottom = 20;
    const bubblesStartY =
      titlePosition + currentTitleText.height + titleMarginBottom;
    const centerY = bubblesStartY + (canvasHeight - bubblesStartY) * 0.4;
    const spawnRadius = Math.min(
      canvasWidth / 3,
      (canvasHeight - bubblesStartY) * 0.4
    );

    data.value
      .sort((a, b) => b.total - a.total)
      .forEach((bubbleData) => {
        const radius = radiusFromTotal(bubbleData.total, canvasWidth);

        const container = new PIXI.Container() as BubbleContainer;
        container.eventMode = "static";
        container.cursor = "pointer";
        container.data = bubbleData;
        container.id = bubbleData._id;
        container.radius = radius;
        container.vx = (Math.random() - 0.5) * 0.1;
        container.vy = (Math.random() - 0.5) * 0.1;

        const graphics = new PIXI.Graphics();
        drawBubble(graphics, bubbleData, canvasWidth);
        container.addChild(graphics);
        container.graphics = graphics;

        const text = createBubbleText(bubbleData, radius, canvasWidth);
        container.addChild(text);
        container.text = text;

        const maxRadius = Math.max(
          ...data.value.map((d) => radiusFromTotal(d.total, canvasWidth))
        );
        const sizeRatio = radius / maxRadius;
        const isLargeBubble = sizeRatio >= PHYSICS_CONFIG.largeBubbleThreshold;

        if (isLargeBubble) {
          const angle = Math.random() * Math.PI * 2;
          const distance =
            Math.random() * (PHYSICS_CONFIG.centerZoneRadius * 0.3);
          container.x = centerX + distance * Math.cos(angle);
          container.y = centerY + distance * Math.sin(angle);
        } else {
          const angle = Math.random() * Math.PI * 2;
          const minDistance = PHYSICS_CONFIG.centerZoneRadius * 0.8;
          const distance =
            minDistance + Math.random() * (spawnRadius - minDistance);
          container.x = centerX + distance * Math.cos(angle);
          container.y = centerY + distance * Math.sin(angle);
        }

        container.on("pointerover", (e: PIXI.FederatedPointerEvent) =>
          onPointerOver(e, container)
        );
        container.on("pointerout", onPointerOut);

        pixiApp?.stage.addChild(container);
        bubbleContainers.value.push(container);
      });
  };

  const reinitialize = () => {
    if (pixiApp) {
      initializeBubbles();
    }
  };

  const initializePixi = async () => {
    if (pixiContainerRef.value && !pixiApp) {
      pixiApp = new PIXI.Application();

      await pixiApp.init({
        width: 800,
        height: 450,
        background: 0xffffff,
        resolution: window.devicePixelRatio || 1,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });

      pixiContainerRef.value.appendChild(pixiApp.canvas);
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      initializeBubbles();
      pixiApp.ticker.add(updatePhysics);
    } else if (pixiApp) {
      resizeCanvas();
    }
  };

  const destroyPixi = () => {
    window.removeEventListener("resize", resizeCanvas);
    if (pixiApp) {
      pixiApp.ticker.remove(updatePhysics);
      pixiApp.destroy();
      pixiApp = null;
      currentTitleText = null;
    }
    bubbleContainers.value = [];
  };

  return {
    pixiContainerRef,
    tooltip,
    reinitialize,
    initializePixi,
    destroyPixi,
  };
}
