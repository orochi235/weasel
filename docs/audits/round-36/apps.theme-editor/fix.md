- gen-brand-colors writes an empty LEGO/Copic table over the committed one when the source sends an error or block page (A+B): fixed 780e9dc72d
- gen-brand-colors writes to paths relative to the cwd (A+B): fixed 406c143eb8
- a Copic row with no name is written as `name: undefined`, and its hex is never checked (A): fixed 9aa0ca1991. This was a strict call: the script throws rather than skipping the row. Recorded in `docs/unruled.md` (0c40041676).
- the generated row order depends on the machine's locale (A): fixed d2e809b615
- Brickset names are written without decoding HTML entities (B): fixed 694d427f03. A named reference with no decoding throws, under the same unruled entry.
- Copic's 0000/000/00 tiers are sorted out of Copic's own order (B): fixed 6985995724. The committed `copicColors.ts` is re-sorted to match (21 rows moved).
- fleet-dev prints theme-editor's URL at `/` when Vite serves it under `/weasel/theme-editor/` (B): fixed 17faf215a1. The same fix applies to chart (`/weasel/chart/`).

Extra defects:
- fleet-dev also printed `site` at `/` when its base is `/weasel/`: fixed 17faf215a1. The app table moved to `scripts/lib/fleet-dev-apps.mjs`, and a test now checks each app's path against its Vite config's dev `base`.

No changesets: `apps/theme-editor` has no `package.json`, and neither it nor `scripts/` is a published package, so no consumer can see these changes. `typecheck:packages` doesn't apply for the same reason, so I ran the root `npm run typecheck` instead.

Checks:
- `npx vitest run --maxWorkers=1 apps/theme-editor/scripts/brand-colors.test.ts`: pass (14/14). Each new test except the path test failed on the code before its fix.
- `npx vitest run --maxWorkers=1 scripts/fleet-dev-apps.test.ts`: pass (6/6). The site, chart and theme-editor cases failed with the old paths.
- `npm run typecheck`: pass
- eslint on the changed files: pass (0 errors; 2 warnings saying the `.d.mts` files are ignored)
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- I never ran the generator script itself against the network.
- Tree is clean.