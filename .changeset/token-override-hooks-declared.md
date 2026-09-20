---
'@weasel-js/theme': patch
---

The ten consumer override hooks — `--wzl-swatch-size`, `--wzl-timeline-label-w`, `--wzl-number-field-width` and seven more — are declared in `packages/theme/src/hooks.ts` and appear in `TOKEN_MANIFEST` as rows with a new `hook: true` field, carrying the fallback kit CSS reads them with and a description of what each one sizes. `TokenManifestEntry` gains that field. The theme README documents them, and `scripts/check-token-reads.ts` now reads the same list instead of holding its own copy.

The manifest is where they belong rather than `tokens.css`, because a hook's contract is that no theme declares it: a `:root` value would outrank the fallback written beside every read, leaving two places that must agree forever, and `check:token-reads` would stop enforcing that the fallback is there. A test asserts the stylesheet declares none of them. The manifest already carries every token's type, default and description for tooling — forge's CSS-vars panel reads it — so the ten now list there beside the tokens, marked as the different thing they are.
