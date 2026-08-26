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
</script>

<main>
  <GameCanvas {state} onState={update} />
  <section class="hud" aria-live="polite">
    <p class="eyebrow">SEED · {state.seed}</p>
    <h1>{state.paused ? 'The wilds wait' : 'The wilds are listening'}</h1>
    <p class="instruction">Tap a bright tile to guide the Wayfarer. Explore shrines, ruins, and Ashwood.</p>
    <div class="facts">
      <span class:active={state.facts.villageAlarm}>Ashwood {state.facts.villageAlarm ? 'alarmed' : 'watchful'}</span>
      <span class:active={state.facts.shrineBlessed}>Shrine {state.facts.shrineBlessed ? 'lit' : 'silent'}</span>
    </div>
    <div class="buttons">
      <button onclick={togglePause}>{state.paused ? 'Resume' : 'Pause'}</button>
      <button onclick={newWorld}>New world</button>
    </div>
  </section>
  <aside class="chronicle" aria-label="World events">
    <p class="eyebrow">CHRONICLE</p>
    {#each state.events as item (item.id)}
      <p>{item.text}</p>
    {/each}
  </aside>
</main>
