# GitHub Pages deploy: docs + Storybook

**Date:** 2026-06-12
**Status:** Approved

## Goal

Publish a single GitHub Pages site at `https://orochi235.github.io/labkit/` containing
a VitePress docs site at the root and the Storybook build at `/storybook/`,
deployed automatically from `main` by GitHub Actions.

## Site layout

- `/` — VitePress docs (source: `docs/`, config: `docs/.vitepress/`, base `/labkit/`)
- `/storybook/` — output of `storybook build`, copied into the VitePress dist

## Docs site (VitePress)

- Home page (`docs/index.md`) includes the repo `README.md` via
  `<!--@include: ../README.md-->` so the two never drift.
- Nav pages: `RECIPES.md` (Recipes), `AGENTS.md` (Agent Guide), plus an external
  nav link to `/labkit/storybook/`.
- Excluded from the site: `docs/IDEAS.md`, `docs/superpowers/**`.
- New npm scripts: `docs:dev`, `docs:build`, `docs:preview`.
- `docs/.vitepress/dist` and `docs/.vitepress/cache` gitignored.

## CI deploy (GitHub Actions)

- Workflow `.github/workflows/deploy-pages.yml`, triggered on push to `main`
  (plus `workflow_dispatch`).
- Checks out `labkit` and `weasel` side-by-side so the `file:../weasel`
  dependencies resolve. `orochi235/weasel` is public, so no token/PAT is needed.
- Build order: weasel `npm ci` + `npm run build` (root tsup; the
  `weasel-modes`/`weasel-ui` workspace packages ship TS source and need no build),
  then labkit `npm ci`, `docs:build`, `build-storybook`, copy
  `storybook-static/` → `docs/.vitepress/dist/storybook/`.
- Deploy via `actions/upload-pages-artifact` + `actions/deploy-pages`.
- Repo Pages config set to "GitHub Actions" source.

## README updates

- Replace the `npm install @labkit/react` instructions: the `@labkit` npm scope
  is not owned, and the package is intentionally local-install-only for now
  (`file:` dependency on a local clone).
- Link to the deployed docs site and Storybook.
- Link to the SpeechBalloonPanels Storybook story as a sample implementation.
- Links use absolute site URLs so they work both on GitHub and when the README
  is included into the docs home page.

## Out of scope

- Publishing labkit or weasel to npm.
- Versioned docs, search beyond VitePress defaults, custom domain.
