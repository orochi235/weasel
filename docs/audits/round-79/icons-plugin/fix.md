The two halves of the duplicate finding have one fix. Tally counts the seven findings as they were listed.

Claim: esbuild-only IIFE exemption; vite, rollup and rolldown IIFE builds still fail (A) — fixed 00f78ade13

Claim: guard refuses an IIFE build with `format` left unset (A+B, listed twice) — fixed 00f78ade13

Claim: whether a package's table enters `/all` depended on whether its modules were `.vue` or `.ts` (A) — fixed 19633868d0

Claim: a package with a `weaselIcons` field but no built table had its tables read in dev and missed in a build (A) — fixed 60e47f44ab

Claim: `export { type icon }` warned as a re-export (A) — fixed ee36c354c3

Claim: `declare function icon` in a namespace did not shadow the imported `icon` (B) — fixed 469604a8e2

Extra fixes, none counted: the dev-side check for a `weaselIcons` field matched the raw text of `package.json`. It now reads the parsed field. This came with 60e47f44ab, where dev and build now share `declaredTables`.

Checks:
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/rewrite.test.ts`: pass (35 passed)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/tables.test.ts`: pass (12 passed)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/plugin.build.test.ts`: pass (22 passed)
- `npx vitest run --maxWorkers=1 packages/icons-plugin/src/library.build.test.ts`: pass (5 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run typecheck:packages -- icons-plugin`: pass ("1/1 icons-plugin ok")
- `npm run lint -w @weasel-js/icons-plugin`: not run, because the package has no `lint` script ("Missing script: \"lint\""). The root `npm run lint` passed inside `checks:gate`.
- `npx eslint packages/icons-plugin/src`: did not run. npx failed with "command not found: _pw_npm_token", a shell-profile error. The root lint in the gate covers these files.

tally: 7 of 7 fixed, 0 extra fixed