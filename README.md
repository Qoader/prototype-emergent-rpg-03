# Emberwild

A mobile-first, procedural heroic-fantasy exploration sandbox built with Svelte, PixiJS, Vite, and TypeScript.

## Start

```sh
pnpm install
pnpm dev
```

`pnpm-workspace.yaml` requires every resolved package release to be at least seven days old. Use `pnpm build`, `pnpm check`, `pnpm lint`, `pnpm format:check`, and `pnpm test:e2e` before publishing.

## Play

Tap or click a bright map tile to route the Wayfarer to it. The world is deterministic from its displayed seed. Explore landmarks while the Gloam Pack, Ashwood Guard, and village alarm react to one another. The browser saves the current seed and simulation automatically; **New world** replaces it.

## Design

Svelte owns the responsive HUD and lifecycle, Pixi owns map rendering and pointer input, and `src/lib/engine` contains serializable deterministic state, world generation, A* routing, event rules, and persistence. There is no server or external art pipeline.

## Deployment

Pushes to `main` run checks and publish `dist` to `gh-pages`. In GitHub repository settings, choose **Pages → Deploy from a branch → gh-pages / (root)** once. The production URL is expected at `https://qoader.github.io/prototype-emergent-rpg-03/`.
