<script lang="ts">
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { onMount } from 'svelte';
  import { advanceSimulation, requestMove } from './engine/simulation';
  import type { GridPoint, SimulationState, Terrain, Tile, WorldPoint } from './engine/types';

  let { state: simulation, onState }: { state: SimulationState; onState: (state: SimulationState) => void } = $props();
  let host: HTMLDivElement;
  let current = $state<SimulationState>({} as SimulationState);
  const tileSize = 32;
  const fixedStep = 1 / 60;
  const colors: Record<Terrain, number> = { meadow: 0x5d8a50, forest: 0x2d6043, water: 0x235b78, mountain: 0x59616a };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  onMount(() => {
    const app = new Application();
    const worldLayer = new Container();
    const mapLayer = new Container();
    const routeLayer = new Container();
    const actorLayer = new Container();
    actorLayer.sortableChildren = true;
    let title: Text | undefined;
    let accumulator = 0;
    let lastPublished = 0;
    // Pixi owns these mutable render caches.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    let previous = new Map<string, WorldPoint>();
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    let actorGraphics = new Map<string, Graphics>();
    let initializedSeed = '';
    let routeSignature = '';
    let mapSignature = '';
    const publish = () => {
      const snapshot = JSON.parse(JSON.stringify(current)) as SimulationState;
      snapshot.paused = simulation.paused;
      onState(snapshot);
    };

    const camera = (heroPosition: WorldPoint): GridPoint => {
      const worldWidth = current.map.width * tileSize;
      const worldHeight = current.map.height * tileSize;
      return {
        x: clamp(app.renderer.width / 2 - heroPosition.x * tileSize, Math.min(0, app.renderer.width - worldWidth), 0),
        y: clamp(app.renderer.height / 2 - heroPosition.y * tileSize, Math.min(0, app.renderer.height - worldHeight), 0),
      };
    };

    const drawTile = (tile: Tile): Graphics => {
      const px = tile.x * tileSize;
      const py = tile.y * tileSize;
      const graphic = new Graphics().rect(px, py, tileSize, tileSize).fill({ color: colors[tile.terrain] });
      if (tile.terrain === 'water') graphic.rect(px, py + 21, tileSize, 2).fill({ color: 0x6ca6ba, alpha: 0.55 });
      if (tile.road) graphic.rect(px + 4, py + 11, 24, 10).fill({ color: 0xc6a56d });
      if (tile.tree) { graphic.circle(px + 16, py + 12, 10).fill({ color: 0x173f2b }); graphic.rect(px + 14, py + 17, 4, 13).fill({ color: 0x6d492d }); }
      if (tile.building) {
        const roof = tile.building === 'capital' ? 0xd8b066 : tile.building === 'city' ? 0xb7755e : 0x95644d;
        graphic.rect(px + 5, py + 13, 22, 16).fill({ color: 0xe1c699 });
        graphic.poly([px + 3, py + 14, px + 16, py + 4, px + 29, py + 14]).fill({ color: roof });
        graphic.rect(px + 14, py + 21, 5, 8).fill({ color: 0x68452f });
      }
      return graphic;
    };

    const makeActor = (entity: SimulationState['entities'][number]): Graphics => {
      const graphic = new Graphics();
      graphic.circle(0, -25, 6).fill({ color: 0xf0c39e });
      graphic.rect(-7, -19, 14, 15).fill({ color: entity.color });
      graphic.rect(-6, -4, 4, 4).fill({ color: 0x27313a }); graphic.rect(2, -4, 4, 4).fill({ color: 0x27313a });
      graphic.stroke({ color: 0x182027, width: 1.5 });
      return graphic;
    };

    const rebuildMap = (offset: GridPoint) => {
      mapLayer.removeChildren().forEach((child) => child.destroy());
      const firstX = Math.max(0, Math.floor(-offset.x / tileSize) - 2);
      const firstY = Math.max(0, Math.floor(-offset.y / tileSize) - 2);
      const lastX = Math.min(current.map.width - 1, Math.ceil((app.renderer.width - offset.x) / tileSize) + 2);
      const lastY = Math.min(current.map.height - 1, Math.ceil((app.renderer.height - offset.y) / tileSize) + 2);
      for (let y = firstY; y <= lastY; y += 1) for (let x = firstX; x <= lastX; x += 1) mapLayer.addChild(drawTile(current.map.tiles[y * current.map.width + x]));
      for (const settlement of current.map.settlements) {
        if (settlement.position.x < firstX - 3 || settlement.position.x > lastX + 3 || settlement.position.y < firstY - 3 || settlement.position.y > lastY + 3) continue;
        const country = current.map.countries.find((candidate) => candidate.id === settlement.countryId);
        const label = new Text({ text: settlement.kind === 'capital' ? country?.name ?? settlement.name : settlement.name, style: { fill: settlement.kind === 'capital' ? 0xffe3a1 : 0xf4ead3, fontFamily: 'Georgia, serif', fontSize: settlement.kind === 'capital' ? 14 : 11, stroke: { color: 0x16251e, width: 3 } } });
        label.anchor.set(0.5, 1); label.x = settlement.position.x * tileSize + 16; label.y = (settlement.position.y - settlement.radius - 1) * tileSize;
        mapLayer.addChild(label);
      }
    };

    const render = (alpha: number) => {
      const hero = current.entities.find((entity) => entity.id === 'hero')!;
      const heroPrevious = previous.get(hero.id) ?? hero.position;
      const heroPosition = { x: heroPrevious.x + (hero.position.x - heroPrevious.x) * alpha, y: heroPrevious.y + (hero.position.y - heroPrevious.y) * alpha };
      const offset = camera(heroPosition);
      worldLayer.position.set(offset.x, offset.y);
      const firstX = Math.max(0, Math.floor(-offset.x / tileSize) - 2);
      const firstY = Math.max(0, Math.floor(-offset.y / tileSize) - 2);
      const lastX = Math.min(current.map.width - 1, Math.ceil((app.renderer.width - offset.x) / tileSize) + 2);
      const lastY = Math.min(current.map.height - 1, Math.ceil((app.renderer.height - offset.y) / tileSize) + 2);
      const nextMapSignature = `${firstX},${firstY},${lastX},${lastY}`;
      if (nextMapSignature !== mapSignature) { mapSignature = nextMapSignature; rebuildMap(offset); }
      const route = hero.navigation.edge ? [hero.navigation.edge.target, ...hero.navigation.waypoints] : hero.navigation.waypoints;
      const nextRouteSignature = route.map((step) => `${step.x},${step.y}`).join(';');
      if (nextRouteSignature !== routeSignature) {
        routeSignature = nextRouteSignature;
        routeLayer.removeChildren().forEach((child) => child.destroy());
        for (const step of route) routeLayer.addChild(new Graphics().circle(step.x * tileSize + 16, step.y * tileSize + 16, 2.5).fill({ color: 0xffe8a4, alpha: 0.8 }));
      }
      for (const entity of current.entities) {
        let graphic = actorGraphics.get(entity.id);
        if (!graphic) { graphic = makeActor(entity); actorGraphics.set(entity.id, graphic); actorLayer.addChild(graphic); }
        const from = previous.get(entity.id) ?? entity.position;
        const position = { x: from.x + (entity.position.x - from.x) * alpha, y: from.y + (entity.position.y - from.y) * alpha };
        graphic.position.set(position.x * tileSize, position.y * tileSize);
        graphic.visible = position.x >= -2 && position.y >= -2 && position.x <= current.map.width + 1 && position.y <= current.map.height + 1;
      }
      for (const child of actorLayer.children) child.zIndex = child.y;
    };

    void app.init({ resizeTo: host, background: 0x101d1b, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) }).then(() => {
      // Pixi owns this canvas outside Svelte's DOM tree.
      // eslint-disable-next-line svelte/no-dom-manipulating
      host.appendChild(app.canvas);
      title = new Text({ text: 'EMBERWILD', style: { fill: 0xffe1a0, fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 'bold', letterSpacing: 2 } });
      title.x = 18; title.y = 15;
      worldLayer.addChild(mapLayer, routeLayer, actorLayer); app.stage.addChild(worldLayer, title); app.stage.sortableChildren = true;
      app.stage.eventMode = 'static'; app.stage.hitArea = app.screen;
      app.stage.on('pointertap', (event) => {
        const hero = current.entities.find((entity) => entity.id === 'hero')!;
        const pos = previous.get(hero.id) ?? hero.position;
        const offset = camera(pos);
        const mapPoint: GridPoint = { x: Math.floor((event.global.x - offset.x) / tileSize), y: Math.floor((event.global.y - offset.y) / tileSize) };
        if (requestMove(current, mapPoint)) { previous.set(hero.id, { ...hero.position }); publish(); render(1); }
      });
      initializedSeed = current.seed;
      for (const entity of current.entities) previous.set(entity.id, entity.position);
      app.ticker.add((ticker) => {
        // Pause is an external control. Apply it and skip this publication so a
        // stale render frame cannot immediately overwrite the HUD state.
        if (current.paused !== simulation.paused) {
          current.paused = simulation.paused;
          render(1);
          return;
        }
        if (current.seed !== initializedSeed) { actorGraphics.forEach((graphic) => graphic.destroy()); actorGraphics = new Map(); mapLayer.removeChildren(); routeLayer.removeChildren(); routeSignature = ''; mapSignature = ''; initializedSeed = current.seed; previous = new Map(current.entities.map((entity) => [entity.id, entity.position])); }
        accumulator += Math.min(ticker.deltaMS / 1000, 0.25);
        let steps = 0;
        while (accumulator >= fixedStep && steps++ < 15) {
          previous = new Map(current.entities.map((entity) => [entity.id, { ...entity.position }]));
          advanceSimulation(current, fixedStep); accumulator -= fixedStep;
        }
        const now = performance.now();
        if (now - lastPublished >= 250) { lastPublished = now; publish(); }
        render(accumulator / fixedStep);
      });
      render(1);
    });
    return () => app.destroy(true, { children: true });
  });

  $effect(() => {
    if (!current.seed || current.seed !== simulation.seed) current = structuredClone(simulation);
    else current.paused = simulation.paused;
  });
</script>

<div class="game-canvas" bind:this={host} aria-label="Emberwild game map" role="application"></div>
