<script lang="ts">
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { onMount } from 'svelte';
  import { requestMove, tick } from './engine/simulation';
  import type { GridPoint, SimulationState, Terrain } from './engine/types';

  let { state: simulation, onState }: { state: SimulationState; onState: (state: SimulationState) => void } = $props();
  let host: HTMLDivElement;
  // Pixi owns this mutable simulation copy between Svelte updates.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let current = $state<SimulationState>({} as SimulationState);

  const colors: Record<Terrain, number> = {
    meadow: 0x486d44,
    forest: 0x203f35,
    water: 0x1d5266,
    mountain: 0x39424a,
    road: 0x9b855e,
  };
  const tileSize = 32;

  const actorColor = (kind: string): number =>
    kind === 'hero' ? 0xf6ce72 : kind === 'guard' ? 0x8dc8e6 : 0xbf5b63;

  onMount(() => {
    const app = new Application();
    let scene = new Container();
    let title: Text | undefined;
    let elapsed = 0;

    const draw = () => {
      scene.destroy({ children: true });
      scene = new Container();
      const worldWidth = current.map.width * tileSize;
      const worldHeight = current.map.height * tileSize;
      scene.x = Math.max(12, (app.renderer.width - worldWidth) / 2);
      scene.y = Math.max(54, (app.renderer.height - worldHeight) / 2);

      for (const tile of current.map.tiles) {
        const cell = new Graphics().rect(tile.x * tileSize, tile.y * tileSize, tileSize - 1, tileSize - 1).fill({ color: colors[tile.terrain] });
        if (!tile.discovered) cell.rect(tile.x * tileSize, tile.y * tileSize, tileSize - 1, tileSize - 1).fill({ color: 0x101820, alpha: 0.82 });
        if (tile.landmark && tile.discovered) {
          const markerColor = tile.landmark === 'village' ? 0xffd37f : tile.landmark === 'shrine' ? 0xa98cff : 0xd4775f;
          cell.circle(tile.x * tileSize + tileSize / 2, tile.y * tileSize + tileSize / 2, 7).fill({ color: markerColor });
        }
        scene.addChild(cell);
      }
      const hero = current.entities.find((entity) => entity.id === 'hero')!;
      for (const step of hero.route) {
        scene.addChild(new Graphics().circle(step.x * tileSize + 16, step.y * tileSize + 16, 3).fill({ color: 0xffe8a4, alpha: 0.7 }));
      }
      for (const entity of current.entities) {
        if (!current.map.tiles[entity.position.y * current.map.width + entity.position.x].discovered) continue;
        const actor = new Graphics().circle(entity.position.x * tileSize + 16, entity.position.y * tileSize + 16, entity.kind === 'hero' ? 10 : 7).fill({ color: actorColor(entity.kind) });
        actor.stroke({ color: 0x101418, width: 2 });
        scene.addChild(actor);
      }
      app.stage.addChild(scene);
      if (title) app.stage.addChild(title);
    };

    void app.init({ resizeTo: host, background: 0x101d1b, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) }).then(() => {
      // Pixi's canvas is intentionally attached outside Svelte's DOM tree.
      // eslint-disable-next-line svelte/no-dom-manipulating
      host.appendChild(app.canvas);
      title = new Text({ text: 'EMBERWILD', style: { fill: 0xffe1a0, fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 'bold', letterSpacing: 2 } });
      title.x = 18;
      title.y = 15;
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointertap', (event) => {
        const mapPoint: GridPoint = {
          x: Math.floor((event.global.x - scene.x) / tileSize),
          y: Math.floor((event.global.y - scene.y) / tileSize),
        };
        if (requestMove(current, mapPoint)) {
          onState(current);
          draw();
        }
      });
      app.ticker.add((ticker) => {
        elapsed += ticker.deltaMS;
        if (elapsed < 250) return;
        elapsed = 0;
        tick(current);
        onState(current);
        draw();
      });
      draw();
    });

    return () => app.destroy(true, { children: true });
  });

  $effect(() => {
    current = structuredClone(simulation);
  });
</script>

<div class="game-canvas" bind:this={host} aria-label="Emberwild game map" role="application"></div>
