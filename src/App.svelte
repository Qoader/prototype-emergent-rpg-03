<script lang="ts">
  import GameCanvas from './lib/GameCanvas.svelte';
  import { createWorld } from './lib/engine/simulation';
  import { clearWorld, loadWorld, saveWorld } from './lib/engine/save';
  import { randomSeed } from './lib/engine/random';
  import type { SimulationState } from './lib/engine/types';

  let state: SimulationState = loadWorld() ?? createWorld(randomSeed());
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function update(next: SimulationState): void {
    state = next;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWorld(state), 200);
  }

  function newWorld(): void {
    clearWorld();
    update(createWorld(randomSeed()));
  }

  function togglePause(): void {
    state.paused = !state.paused;
    update(state);
  }

  function location(): string {
    const hero = state.entities.find((entity) => entity.id === 'hero');
    if (!hero) return '';
    const tile = state.map.tiles[hero.position.y * state.map.width + hero.position.x];
    const country = state.map.countries.find((candidate) => candidate.id === tile?.countryId);
    const settlement = state.map.settlements.find((candidate) => candidate.id === tile?.settlementId);
    return settlement ? `${settlement.name}, ${country?.name ?? 'the wilds'}` : country ? `${country.name} ${country.government}` : 'the wilds';
  }
</script>

<main>
  <GameCanvas {state} onState={update} />
  <section class="hud" aria-live="polite">
    <p class="eyebrow">SEED · {state.seed}</p>
    <h1>{state.paused ? 'The wilds wait' : 'The wilds are listening'}</h1>
    <p class="instruction">Tap any walkable tile to guide the Wayfarer across the continent.</p>
    <div class="facts">
      <span>{location()}</span>
      <span>{state.map.countries.length} realms</span>
    </div>
    <div class="buttons">
      <button onclick={togglePause}>{state.paused ? 'Resume' : 'Pause'}</button>
      <button onclick={newWorld}>New world</button>
    </div>
  </section>
</main>
