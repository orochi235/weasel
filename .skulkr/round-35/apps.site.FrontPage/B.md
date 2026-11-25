# Audit round 35: apps.site.FrontPage

Note: the brief's frozen commit 197362e015 is not in this clone (`git cat-file` reports bad object); everything here was read at HEAD 6636588122.

## The front page clips its section links on short viewports, and nothing on the page can scroll
- where: apps/site/FrontPage/FrontPage.module.css:1 (.page)
- scenario: `.page` is `height: 100%; overflow: hidden; display: grid; place-items: center`, inside `html, body, #root { height: 100%; overflow: hidden }` (apps/site/canvas-kit-demo.css:8). The column holds a 72px wordmark, the pill, the tagline, the install line and seven link cards in a 3-column grid (2 columns under 480px wide, so 4 rows). On a viewport shorter than that column (a phone in landscape at about 375px tall, or a short desktop window) the centered grid overflows both top and bottom, and the overflow is clipped with no scrollbar. The wordmark and the bottom link rows ("Components", "WeaselDraw", "WeaselChart", "Releases") cannot be reached. What should happen: the page scrolls (`overflow: auto`, with `min-height` in place of the fixed centering) once the content is taller than the viewport.
- evidence: read
- severity: medium

## On the site's dev server, the "WeaselChart" and "Components" cards load the front page again
- where: apps/site/FrontPage/FrontPage.tsx:16-18 (LINKS)
- scenario: `./chart/` and `./docs/ui/forge/` resolve to `/weasel/chart/` and `/weasel/docs/ui/forge/`. Production builds work because pages.yml copies dist-chart and dist-forge into those paths. The site's dev server (vite.config.ts:99) proxies only `/weasel/draw`, so it answers both other paths with vite's SPA fallback, the site's own index.html, and that shows the front page again. Forge's dev base is `/` (apps/forge/vite.config.ts:29), so a proxy could not forward the path unchanged anyway. The "WeaselDraw" card works through its proxy. The same two links in the sidebar (WeaselDemos.tsx) behave the same way. What should happen: every front-page card reaches its app under `dev:kit`, as WeaselDraw's does, or the dev server routes these two paths.
- evidence: read
- severity: low

## Files read
apps/site/FrontPage/FrontPage.module.css
apps/site/FrontPage/FrontPage.tsx
apps/site/FrontPage/GetStarted.module.css
apps/site/FrontPage/GetStarted.tsx
apps/site/FrontPage/VersionPill.module.css
apps/site/FrontPage/VersionPill.tsx
apps/site/FrontPage/Wordmark.module.css
apps/site/FrontPage/Wordmark.tsx
apps/site/FrontPage/projectTheme.ts
apps/site/FrontPage/tagline.ts

<!-- done: 2 findings, files read: 10 -->
