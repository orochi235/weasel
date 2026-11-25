- API table loses destructured defaults and the TypeDoc name for `export default memo(…)`/`forwardRef(…)` (A): fixed 77b86d1049
- Dependency graph and API table pick different components when the meta's `component` comes from a dependency (A): fixed 333b0b5944. The API table now takes the component the graph takes. Prop controls still read the meta's `component`. I made this call myself and recorded it in `docs/unruled.md`.
- `unquoted` mangles non-BMP characters in a C-quoted git path (A): fixed 2829e52481
- Issues endpoint answers any Host and Origin, so a DNS-rebound page can read the repository and its issues (B): fixed 2f3e54ba60
- `hmrSocketOf` uses `??` where vite's client uses `||`, so an empty `hmr.host` or `protocol` fails every capture (B): fixed 4ce565304c
- API table falls back to a wrapper the story file declares when no import matches the title, where the graph finds no component (B): fixed 333b0b5944, in the same change as the dependency finding. The panel now shows no table there, and the existing test expecting the wrapper's props was changed to expect none. This call is also recorded in `docs/unruled.md`.
- `forgeTest` emits nothing for a story file with no indexable stories, so vitest fails it (B): fixed 1b01e3d908. The file now registers one skipped test. The existing test expecting the file to be left alone was replaced.
- `unquoted` encodes one UTF-16 unit at a time (B): duplicate of A's `unquoted` finding, fixed in 2829e52481
- A `var` inside a class `static {}` block is scoped wrongly in both scope walkers (B): fixed d6074eb6b0
- Component label goes unescaped to `gh --label`, which splits it at commas (B): fixed f6ff81d107. A name holding a comma, a double quote, or a control character now gets a 400. I made this call myself and recorded it in `docs/unruled.md`.

Extra defects: none.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`, plus the related `plugin`, `indexFile`, and `componentGraph` files: pass. That covers `apiTable`, `propTypes`, `propControls`, `history`, `issues/endpoint`, `capture/endpoint`, `forgeTest`, `ast` (new file), and `freeNames`. No browser tests are involved.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on a TS2345 in `ast.ts` in `typecheck` and `typecheck:packages`; that is fixed and folded into d6074eb6b0.
- `npm run lint -w @weasel-js/forge`: forge has no lint script ("Missing script: \"lint\""). I ran eslint on every changed package file instead: pass.
- `npm run check:changesets`: pass.

tally: 9 of 10 fixed, 0 extra fixed