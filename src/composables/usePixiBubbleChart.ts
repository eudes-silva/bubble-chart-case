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

export function usePixiBubbleChart(
  data: Ref<BubbleData[]>,
  title: Ref<string>
) {
  const TITLE_HEIGHT = 60;

  const pixiContainerRef = ref<HTMLDivElement | null>(null);
  const containerRef = ref<HTMLDivElement | null>(null);
  const bubbleContainers = ref<BubbleContainer[]>([]);
  const activeBubble = ref<BubbleContainer | null>(null);
  const devicePixelRatio = ref(1);

  let pixiApp: PIXI.Application | null = null;

  const { calculatePercentages } = usePercentageCalculator();

  const tooltip = ref<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const radiusFromTotal = (total: number): number => {
    return Math.max(30, Math.sqrt(total) * 8);
  };

  const getResponsiveTitleSize = (canvasWidth: number): number => {
    if (canvasWidth < 640) return 18;
    if (canvasWidth < 768) return 20;
    if (canvasWidth < 1024) return 24;
    if (canvasWidth < 1280) return 30;
    return 36;
  };

  const getTitlePosition = (canvasHeight: number): number => {
    return canvasHeight < 400 ? 16 : 24;
  };

  const resizeCanvas = () => {
    if (!pixiApp || !containerRef.value) return;

    const parentWidth = containerRef.value.clientWidth;
    const parentHeight = containerRef.value.clientHeight;

    if (window.innerWidth < 768) {
      pixiApp.renderer.resize(parentWidth, parentHeight);
    } else {
      const aspectRatio = 16 / 9;
      let newWidth: number, newHeight: number;

      if (parentWidth / parentHeight > aspectRatio) {
        newHeight = parentHeight;
        newWidth = parentHeight * aspectRatio;
      } else {
        newWidth = parentWidth;
        newHeight = parentWidth / aspectRatio;
      }

      pixiApp.renderer.resize(newWidth, newHeight);
    }

    requestAnimationFrame(() => {
      initializeBubbles();
    });
  };

  const drawBubble = (g: PIXI.Graphics, bubbleData: BubbleData) => {
    g.clear();
    const radius = radiusFromTotal(bubbleData.total);
    const donutThickness = 8;
    const outerRadius = radius;
    const innerRadius = radius - donutThickness;

    g.circle(0, 0, innerRadius);
    g.fill({ color: 0xffffff });

    g.circle(2, 2, outerRadius);
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

    g.circle(0, 0, innerRadius);
    g.stroke({ width: 1, color: 0xcccccc });
  };

  const createBubbleText = (
    bubbleData: BubbleData,
    radius: number
  ): PIXI.Text => {
    const maxFontSize = Math.max(10, Math.min(18, radius * 0.4));
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
    id: any;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    data?: any;
  }

  interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Point {
    x: number;
    y: number;
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
      if (!this.contains(bubble)) {
        return false;
      }

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

      if (this.northeast!.insert(bubble)) return true;
      if (this.northwest!.insert(bubble)) return true;
      if (this.southeast!.insert(bubble)) return true;
      if (this.southwest!.insert(bubble)) return true;

      this.bubbles.push(bubble);
      return true;
    }

    private directInsert(bubble: Bubble): void {
      this.bubbles.push(bubble);
    }

    public clear(): void {
      this.bubbles = [];
      this.divided = false;
      this.northeast = undefined;
      this.northwest = undefined;
      this.southeast = undefined;
      this.southwest = undefined;
    }

    private contains(bubble: Bubble): boolean {
      return (
        bubble.x >= this.boundary.x &&
        bubble.x < this.boundary.x + this.boundary.width &&
        bubble.y >= this.boundary.y &&
        bubble.y < this.boundary.y + this.boundary.height
      );
    }

    private subdivide(): void {
      const { x, y, width, height } = this.boundary;
      const halfWidth = width / 2;
      const halfHeight = height / 2;

      this.northeast = new QuadTree(
        { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        this.currentDepth + 1
      );
      this.northwest = new QuadTree(
        { x, y, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        this.currentDepth + 1
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
        this.currentDepth + 1
      );
      this.southwest = new QuadTree(
        { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.capacity,
        this.maxDepth,
        this.currentDepth + 1
      );

      this.divided = true;

      const oldBubbles = [...this.bubbles];
      this.bubbles = [];

      for (const bubble of oldBubbles) {
        if (this.northeast!.contains(bubble)) {
          this.northeast!.directInsert(bubble);
        } else if (this.northwest!.contains(bubble)) {
          this.northwest!.directInsert(bubble);
        } else if (this.southeast!.contains(bubble)) {
          this.southeast!.directInsert(bubble);
        } else if (this.southwest!.contains(bubble)) {
          this.southwest!.directInsert(bubble);
        }
      }
    }

    queryRange(range: Rectangle): Bubble[] {
      const found: Bubble[] = [];

      if (!this.intersects(range)) {
        return found;
      }

      for (const bubble of this.bubbles) {
        if (this.pointInRectangle(bubble, range)) {
          found.push(bubble);
        }
      }

      if (this.divided) {
        found.push(...this.northeast!.queryRange(range));
        found.push(...this.northwest!.queryRange(range));
        found.push(...this.southeast!.queryRange(range));
        found.push(...this.southwest!.queryRange(range));
      }

      return found;
    }

    queryCircle(center: Point, radius: number): Bubble[] {
      const found: Bubble[] = [];
      const squaredRadius = radius * radius;

      const boundingBox: Rectangle = {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2,
      };

      const candidates = this.queryRange(boundingBox);

      for (const bubble of candidates) {
        const dx = bubble.x - center.x;
        const dy = bubble.y - center.y;
        if (dx * dx + dy * dy <= squaredRadius) {
          found.push(bubble);
        }
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

    private pointInRectangle(point: Point, rect: Rectangle): boolean {
      return (
        point.x >= rect.x &&
        point.x < rect.x + rect.width &&
        point.y >= rect.y &&
        point.y < rect.y + rect.height
      );
    }

    remove(bubble: Bubble): boolean {
      if (!this.contains(bubble)) {
        return false;
      }

      const index = this.bubbles.findIndex(
        (b) =>
          b.x === bubble.x &&
          b.y === bubble.y &&
          (b.id === bubble.id || (!b.id && !bubble.id))
      );

      if (index !== -1) {
        this.bubbles.splice(index, 1);
        return true;
      }

      if (this.divided) {
        return (
          this.northeast!.remove(bubble) ||
          this.northwest!.remove(bubble) ||
          this.southeast!.remove(bubble) ||
          this.southwest!.remove(bubble)
        );
      }

      return false;
    }

    getAllBoundaries(): Rectangle[] {
      const boundaries: Rectangle[] = [this.boundary];

      if (this.divided) {
        boundaries.push(...this.northeast!.getAllBoundaries());
        boundaries.push(...this.northwest!.getAllBoundaries());
        boundaries.push(...this.southeast!.getAllBoundaries());
        boundaries.push(...this.southwest!.getAllBoundaries());
      }

      return boundaries;
    }

    public getBoundary(): Rectangle {
      return { ...this.boundary };
    }

    public getDepth(): number {
      if (!this.divided) {
        return 1;
      }
      return (
        1 +
        Math.max(
          this.northeast!.getDepth(),
          this.northwest!.getDepth(),
          this.southeast!.getDepth(),
          this.southwest!.getDepth()
        )
      );
    }

    public getTotalNodes(): number {
      if (!this.divided) {
        return 1;
      }
      return (
        1 +
        this.northeast!.getTotalNodes() +
        this.northwest!.getTotalNodes() +
        this.southeast!.getTotalNodes() +
        this.southwest!.getTotalNodes()
      );
    }

    public getBubbleCount(): number {
      let count = this.bubbles.length;
      if (this.divided) {
        count += this.northeast!.getBubbleCount();
        count += this.northwest!.getBubbleCount();
        count += this.southeast!.getBubbleCount();
        count += this.southwest!.getBubbleCount();
      }
      return count;
    }

    public getAllBubbles(): Bubble[] {
      let bubbles = [...this.bubbles];
      if (this.divided) {
        bubbles.push(...this.northeast!.getAllBubbles());
        bubbles.push(...this.northwest!.getAllBubbles());
        bubbles.push(...this.southeast!.getAllBubbles());
        bubbles.push(...this.southwest!.getAllBubbles());
      }
      return bubbles;
    }

    public isEmpty(): boolean {
      if (this.bubbles.length > 0) {
        return false;
      }
      if (this.divided) {
        return (
          this.northeast!.isEmpty() &&
          this.northwest!.isEmpty() &&
          this.southeast!.isEmpty() &&
          this.southwest!.isEmpty()
        );
      }
      return true;
    }

    public optimize(): void {
      if (this.divided) {
        this.northeast!.optimize();
        this.northwest!.optimize();
        this.southeast!.optimize();
        this.southwest!.optimize();

        if (
          this.northeast!.isEmpty() &&
          !this.northeast!.divided &&
          this.northwest!.isEmpty() &&
          !this.northwest!.divided &&
          this.southeast!.isEmpty() &&
          !this.southeast!.divided &&
          this.southwest!.isEmpty() &&
          !this.southwest!.divided
        ) {
          this.clear();
        }
      }
    }
  }

  const PHYSICS_CONFIG = {
    damping: 0.85,
    desiredSpacing: 25,
    attractionForce: 0.002,
    repulsionMultiplier: 0.1,
    bounceMultiplier: -1,
  } as const;

  let physicsManagerCache: PhysicsManager | null = null;
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;

  class PhysicsManager {
    public canvasWidth: number;
    public canvasHeight: number;
    private topBoundary: number;
    private centerX: number;
    private centerY: number;
    private quadTree: QuadTree;

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

      this.quadTree = new QuadTree({
        x: 0,
        y: titleHeight,
        width: canvasWidth,
        height: canvasHeight - titleHeight,
      });
    }

    private applyDamping(bubble: Bubble): void {
      bubble.vx *= PHYSICS_CONFIG.damping;
      bubble.vy *= PHYSICS_CONFIG.damping;
    }

    private updatePosition(bubble: Bubble): void {
      bubble.x += bubble.vx;
      bubble.y += bubble.vy;
    }

    private handleWallCollisions(bubble: Bubble): void {
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
    }

    private applyAttractionToCenter(bubble: Bubble): void {
      const dxToCenter = this.centerX - bubble.x;
      const dyToCenter = this.centerY - bubble.y;

      bubble.vx += dxToCenter * PHYSICS_CONFIG.attractionForce;
      bubble.vy += dyToCenter * PHYSICS_CONFIG.attractionForce;
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

    private processCollisionsWithQuadTree(bubbles: Bubble[]): void {
      this.quadTree.clear();

      const visibleBubbles = bubbles.filter((bubble) => bubble.alpha >= 1);
      visibleBubbles.forEach((bubble) => this.quadTree.insert(bubble));

      const processedPairs = new Set<string>();

      for (const bubble of visibleBubbles) {
        const searchRadius = bubble.radius * 3;
        const searchArea = {
          x: bubble.x - searchRadius,
          y: bubble.y - searchRadius,
          width: searchRadius * 2,
          height: searchRadius * 2,
        };

        const nearbyBubbles = this.quadTree.queryRange(searchArea);

        for (const nearbyBubble of nearbyBubbles) {
          if (nearbyBubble !== bubble) {
            const pairKey = `${Math.min(bubble.x, nearbyBubble.x)},${Math.min(
              bubble.y,
              nearbyBubble.y
            )}-${Math.max(bubble.x, nearbyBubble.x)},${Math.max(
              bubble.y,
              nearbyBubble.y
            )}`;

            if (!processedPairs.has(pairKey)) {
              this.handleBubbleCollision(bubble, nearbyBubble);
              processedPairs.add(pairKey);
            }
          }
        }
      }
    }

    updatePhysics(bubbles: Bubble[]): void {
      const visibleBubbles = bubbles.filter((bubble) => bubble.alpha >= 1);

      for (const bubble of visibleBubbles) {
        this.applyDamping(bubble);
        this.updatePosition(bubble);
        this.handleWallCollisions(bubble);
        this.applyAttractionToCenter(bubble);
      }

      this.processCollisionsWithQuadTree(bubbles);
    }
  }

  const updatePhysics = (): void => {
    if (!pixiApp) return;

    const canvasWidth = pixiApp.renderer.width;
    const canvasHeight = pixiApp.renderer.height;

    if (
      !physicsManagerCache ||
      lastCanvasWidth !== canvasWidth ||
      lastCanvasHeight !== canvasHeight
    ) {
      physicsManagerCache = new PhysicsManager(
        canvasWidth,
        canvasHeight,
        TITLE_HEIGHT
      );
      lastCanvasWidth = canvasWidth;
      lastCanvasHeight = canvasHeight;
    }

    physicsManagerCache.updatePhysics(bubbleContainers.value);

    if (activeBubble.value && pixiApp) {
      const rect = pixiApp.canvas.getBoundingClientRect();
      tooltip.value.visible = true;
      tooltip.value.x = rect.left + activeBubble.value.x;
      tooltip.value.y =
        rect.top + activeBubble.value.y - activeBubble.value.radius;
      tooltip.value.data = activeBubble.value.data;
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
    const centerY = TITLE_HEIGHT + (canvasHeight - TITLE_HEIGHT) * 0.4;
    const spawnRadius = Math.min(
      canvasWidth / 3,
      (canvasHeight - TITLE_HEIGHT) * 0.4
    );

    const titleFontSize = getResponsiveTitleSize(canvasWidth);
    const titleText = new PIXI.Text({
      text: title.value,
      style: {
        fontSize: titleFontSize,
        fill: 0x333333,
        fontWeight: "bold",
        wordWrap: true,
        wordWrapWidth: canvasWidth * 0.9,
        align: "center",
      } as PIXI.TextStyle,
    });

    titleText.anchor.set(0.5);
    titleText.x = canvasWidth / 2;
    titleText.y = getTitlePosition(canvasHeight);
    pixiApp.stage.addChild(titleText);

    data.value.forEach((bubbleData) => {
      const radius = radiusFromTotal(bubbleData.total);

      const container = new PIXI.Container() as BubbleContainer;
      container.eventMode = "static";
      container.cursor = "pointer";
      container.data = bubbleData;
      container.radius = radius;
      container.vx = (Math.random() - 0.5) * 0.1;
      container.vy = (Math.random() - 0.5) * 0.1;

      const graphics = new PIXI.Graphics();
      drawBubble(graphics, bubbleData);
      container.addChild(graphics);
      container.graphics = graphics;

      const text = createBubbleText(bubbleData, radius);
      container.addChild(text);
      container.text = text;

      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spawnRadius;
      container.x = centerX + distance * Math.cos(angle);
      container.y = centerY + distance * Math.sin(angle);

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
    if (typeof window !== "undefined") {
      devicePixelRatio.value = window.devicePixelRatio || 1;
    }

    if (pixiContainerRef.value) {
      pixiApp = new PIXI.Application();

      await pixiApp.init({
        width: 800,
        height: 450,
        background: 0xffffff,
        resolution: devicePixelRatio.value,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });

      pixiContainerRef.value.appendChild(pixiApp.canvas);
      containerRef.value = pixiContainerRef.value;

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      initializeBubbles();
      pixiApp.ticker.add(updatePhysics);
    }
  };

  const destroyPixi = () => {
    window.removeEventListener("resize", resizeCanvas);
    if (pixiApp) {
      pixiApp.ticker.remove(updatePhysics);
      pixiApp.destroy();
      pixiApp = null;
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
