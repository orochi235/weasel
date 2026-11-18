I fixed all three findings in separate commits on top of the frozen tree. The browser test for the scroll fix has not been run, because this machine refuses browser-project runs.

The reviewers read HEAD `6636588122`, since `197362e015` isn't in this clone. The files they read are the same in the frozen tree.

- **The front page clips its column on a short viewport and nothing scrolls** (A+B): fixed 6f0bbf81d9. `.page` now has `overflow: auto`, so the page scrolls inside itself and the root still never scrolls. The repro is `apps/site/FrontPage/FrontPage.browser.test.tsx` at a 640×360 viewport. It checks that the wordmark is on screen, that the last link can be scrolled into view, and that `window.scrollY` stays 0.
- **The Components and WeaselChart links show the front page again under the site's dev server** (A+B): fixed 92a39e7d4e.
  - The site's forwarding table is now one module, `scripts/vite-site-proxy.ts`, and it now forwards `/weasel/chart` as well as `/weasel/draw`.
  - Forge's dev base is `/`, so the dev server can't forward its built path unchanged. Instead, the front page and the sidebar's "UI catalog →" link (the same defect, in `WeaselDemos.tsx`) now both use the existing `FORGE_LAB.href` from `apps/shared/labs.ts`.
  - The repro is the new test "links only to apps the dev server can reach" in `apps/site/__tests__/FrontPage.test.tsx`; it failed on `/weasel/docs/ui/forge/` before the fix.
  - No changeset: only the site app changed, which no package consumer sees.
- **The version pill's comment claims it follows the sidebar's placement** (A): fixed 76509f5a39. The sidebar's pill sits 10px up and 1px inside its wordmark's end, while the front page's sits 20px up and 17px past it. I removed the false comment and left the offsets alone, since the placement is a visual choice. A comment can't be tested, and nothing a consumer sees changed, so there is no changeset.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/__tests__/FrontPage.test.tsx`: **pass** (5/5).
- `apps/site/FrontPage/FrontPage.browser.test.tsx`: **unrun** (browser project; the hook refused it here).
- eslint on every changed file: **pass**.
- `npm run check:size`: **pass**.
- `npm run check:changesets`: **pass**.
- `npm run typecheck:packages`: **not run**, because no package changed. The root `npm run typecheck` covering the app files was also not run.

The tree is clean and `.skulk/` is untouched.