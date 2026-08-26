<script lang="ts">
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { onMount } from 'svelte';
  import { requestMove, tick } from './engine/simulation';
  import type { GridPoint, SimulationState, Terrain, Tile } from './engine/types';

  let { state: simulation, onState }: { state: SimulationState; onState: (state: SimulationState) => void } = $props();
  let host: HTMLDivElement;
  // Pixi owns this mutable simulation copy between Svelte updates.
  // eslint-disable-next-line svelte/prefer-writable-derived
  let current = $state<SimulationState>({} as SimulationState);
  const tileSize = 32;
  const colors: Record<Terrain, number> = { meadow: 0x5d8a50, forest: 0x2d6043, water: 0x235b78, mountain: 0x59616a };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  onMount(() => {
    const app = new Application();
    let scene = new Container();
    let title: Text | undefined;
    let elapsed = 0;

    const camera = (): GridPoint => {
      const hero = current.entities.find((entity) => entity.id === 'hero')!;
      const worldWidth = current.map.width * tileSize;
      const worldHeight = current.map.height * tileSize;
      return {
        x: clamp(app.renderer.width / 2 - (hero.position.x + 0.5) * tileSize, Math.min(0, app.renderer.width - worldWidth), 0),
        y: clamp(app.renderer.height / 2 - (hero.position.y + 0.5) * tileSize, Math.min(0, app.renderer.height - worldHeight), 0),
      };
    };

    const drawTile = (tile: Tile): Graphics => {
      const px = tile.x * tileSize;
      const py = tile.y * tileSize;
      const graphic = new Graphics().rect(px, py, tileSize, tileSize).fill({ color: colors[tile.terrain] });
      if (tile.terrain === 'water') graphic.rect(px, py + 21, tileSize, 2).fill({ color: 0x6ca6ba, alpha: 0.55 });
      if (tile.road) graphic.rect(px + 4, py + 11, 24, 10).fill({ color: 0xc6a56d });
      if (tile.tree) {
        graphic.circle(px + 16, py + 12, 10).fill({ color: 0x173f2b });
        graphic.rect(px + 14, py + 17, 4, 13).fill({ color: 0x6d492d });
      }
      if (tile.building) {
        const roof = tile.building === 'capital' ? 0xd8b066 : tile.building === 'city' ? 0xb7755e : 0x95644d;
        graphic.rect(px + 5, py + 13, 22, 16).fill({ color: 0xe1c699 });
        graphic.poly([px + 3, py + 14, px + 16, py + 4, px + 29, py + 14]).fill({ color: roof });
        graphic.rect(px + 14, py + 21, 5, 8).fill({ color: 0x68452f });
      }
      return graphic;
    };

    const drawActor = (entity: SimulationState['entities'][number]): Graphics => {
      const footX = entity.position.x * tileSize + tileSize / 2;
      const footY = entity.position.y * tileSize + tileSize / 2;
      const actor = new Graphics();
      actor.circle(footX, footY - 25, 6).fill({ color: 0xf0c39e });
      actor.rect(footX - 7, footY - 19, 14, 15).fill({ color: entity.color });
      actor.rect(footX - 6, footY - 4, 4, 4).fill({ color: 0x27313a });
      actor.rect(footX + 2, footY - 4, 4, 4).fill({ color: 0x27313a });
      actor.stroke({ color: 0x182027, width: 1.5 });
      return actor;
    };

    const draw = () => {
      scene.destroy({ children: true });
      scene = new Container();
      const offset = camera();
      scene.x = offset.x;
      scene.y = offset.y;
      const firstX = Math.max(0, Math.floor(-offset.x / tileSize) - 2);
      const firstY = Math.max(0, Math.floor(-offset.y / tileSize) - 2);
      const lastX = Math.min(current.map.width - 1, Math.ceil((app.renderer.width - offset.x) / tileSize) + 2);
      const lastY = Math.min(current.map.height - 1, Math.ceil((app.renderer.height - offset.y) / tileSize) + 2);
      for (let y = firstY; y <= lastY; y += 1) {
        for (let x = firstX; x <= lastX; x += 1) {
          const tile = current.map.tiles[y * current.map.width + x];
          scene.addChild(drawTile(tile));
          if (tile.countryId) {
            const east = current.map.tiles[y * current.map.width + x + 1];
            const south = current.map.tiles[(y + 1) * current.map.width + x];
            const country = current.map.countries.find((candidate) => candidate.id === tile.countryId)!;
            if (east && east.countryId !== tile.countryId) scene.addChild(new Graphics().rect((x + 1) * tileSize - 2, y * tileSize, 3, tileSize).fill({ color: country.color, alpha: 0.7 }));
            if (south && south.countryId !== tile.countryId) scene.addChild(new Graphics().rect(x * tileSize, (y + 1) * tileSize - 2, tileSize, 3).fill({ color: country.color, alpha: 0.7 }));
          }
        }
      }
      for (const settlement of current.map.settlements) {
        const { x, y } = settlement.position;
        if (x < firstX - 3 || x > lastX + 3 || y < firstY - 3 || y > lastY + 3) continue;
        const country = current.map.countries.find((candidate) => candidate.id === settlement.countryId);
        const label = new Text({ text: settlement.name, style: { fill: settlement.kind === 'capital' ? 0xffe3a1 : 0xf4ead3, fontFamily: 'Georgia, serif', fontSize: settlement.kind === 'capital' ? 14 : 11, stroke: { color: 0x16251e, width: 3 } } });
        if (settlement.kind === 'capital') label.text = country?.name ?? settlement.name;
        label.anchor.set(0.5, 1);
        label.x = x * tileSize + 16;
        label.y = (y - settlement.radius - 1) * tileSize;
        scene.addChild(label);
      }
      const hero = current.entities.find((entity) => entity.id === 'hero')!;
      for (const step of hero.route) scene.addChild(new Graphics().circle(step.x * tileSize + 16, step.y * tileSize + 16, 2.5).fill({ color: 0xffe8a4, alpha: 0.8 }));
      for (const entity of current.entities) {
        if (entity.position.x >= firstX - 1 && entity.position.x <= lastX + 1 && entity.position.y >= firstY - 1 && entity.position.y <= lastY + 1) scene.addChild(drawActor(entity));
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
        const offset = camera();
        const mapPoint: GridPoint = { x: Math.floor((event.global.x - offset.x) / tileSize), y: Math.floor((event.global.y - offset.y) / tileSize) };
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
  $effect(() => { current = structuredClone(simulation); });
</script>

<div class="game-canvas" bind:this={host} aria-label="Emberwild game map" role="application"></div>
