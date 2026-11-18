I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the full findings document is below.

One caveat: this checkout's HEAD is `6636588122`, not the frozen commit `197362e015` the brief names. I reviewed the files as they are at HEAD. I also couldn't check what changed in the last week, because the `git log` calls needed approval.

## The front page clips its content on a short viewport, with no way to scroll to it
- where: apps/site/FrontPage/FrontPage.module.css:1 (.page)
- scenario: `.page` is set to `height: 100%; overflow: hidden; display: grid; place-items: center`, and `apps/site/canvas-kit-demo.css:8` also pins `html, body, #root` to `height: 100%; overflow: hidden`. The column holds the 72px wordmark, the version pill, the tagline, the install line and seven link cards (3 rows at ≥481px wide, 4 rows at ≤480px). With gaps and padding that is about 500–600px tall. On a phone in landscape (~360–420px tall) or in a short desktop window, the centered column overflows above and below the box and is clipped. The wordmark and the last row of section links are cut off, and nothing scrolls, so those links can't be reached. The page should scroll instead (`overflow: auto`, with `safe center` alignment or a `min-height` rather than a fixed clip).
- evidence: read
- severity: medium

## The version pill's offset claims to be the sidebar's overlap scaled, but the sidebar places it differently
- where: apps/site/FrontPage/FrontPage.module.css:32 (.version)
- scenario: The comment says the margin is "the sidebar's overlap scaled to this wordmark's 72px: 0.28em up into it, 0.23em past its end", which gives -20px / -17px. The sidebar's pill (`apps/site/canvas-kit-demo.css:683`, `.ckd-sidebar-version`) sits under a 54px wordmark with `margin: -2px 0 0 auto` plus `translate(-1px, -8px)`. That is 10px up (0.185em) and 1px *inside* the end, not past it. So the same pill on the same mark is placed two different ways, while the front page says they follow one rule. Either one of the placements or the comment is wrong.
- evidence: read
- severity: low

## The Components and WeaselChart links show the front page again under the site's dev server
- where: apps/site/FrontPage/FrontPage.tsx:16 (LINKS)
- scenario: `./docs/ui/forge/` and `./chart/` resolve to `/weasel/docs/ui/forge/` and `/weasel/chart/`. In production, `pages.yml` copies those builds to those paths. The site's dev server (`server.proxy` in `vite.config.ts`) proxies only `/weasel/draw`. So under the site's dev server, clicking "Components" or "WeaselChart" falls through to the site's own `index.html` and shows the front page again; only "WeaselDraw" reaches its app. Those two paths should be proxied the same way as draw's (chart's base is `/weasel/chart/`, forge's is `/weasel/docs/ui/forge/`).
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

<!-- done: 3 findings, files read: 10 -->