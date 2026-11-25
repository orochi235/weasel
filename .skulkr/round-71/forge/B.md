## describeSchema drops a nested leaf's `encoding`, so the shell refuses or misreads encoded values inside a list, map, object or union
- where: packages/forge/src/protocol/schema.ts:112 (dataOf), used at :142 (describeShape annotations)
- scenario: a story's leaf is `f.list([...], item)` (or a map/object/union) whose item/child PrefLeaf carries `encoding: { read, write }` (functions, as in prefs-schema's own tests). `dataOf(annotations, true)` keeps the nested leaf (it has a `kind`), but its `encoding` member is a plain object holding functions, so it is DROPPED with no marker. The shell rebuilds the schema from this description (`storyInstrument.tsx:34`) and decodes route params against it (`RouteKnobs.tsx:42` → `paramsToKnobs`). `url.ts` `nestedHolds`/`clamped` exempt a leaf only when `'encoding' in leaf`; with the key gone, an encoded entry (e.g. boolean stored as `'italic'`) is judged against its kind, `holds` fails, and the whole knob param in a shared link is refused (and a number stored encoded would be clamped as a raw number). Should keep an `encoded` flag (as `runsInFrame`/`resolves` do) so the rebuilt leaf still declares `encoding` and the URL reader leaves its value alone.
- evidence: read (schema.ts dataOf, url.ts nestedHolds/clamped, prefs-schema tests showing encoding is `{read, write}` functions; the end-to-end link refusal is inferred from the call chain, not run)
- severity: medium

## sameKnob ignores array length, so lists that differ only by trailing `undefined` members compare equal
- where: packages/forge/src/route/url.ts:287 (sameKnob)
- scenario: `sameKnob([1, undefined], [1])` and `sameKnob([undefined], [])` return true: arrays go through the object branch, keys with `undefined` values are filtered, and `length` is never compared. `knobsToParams` then omits a list knob whose value is `[...default, undefined]` though `encodeKnob` would write it as `[…,null]`, and `listWithUnsent` (portSafe.ts:155), which crosses `undefined` members as themselves, can pair an edited list entry with the wrong original. Arrays should compare by length and index, with `undefined` members significant.
- evidence: read
- severity: low

## boundsOf drops a valid finite bound when the other one is non-finite
- where: packages/forge/src/csf/argsToSchema.ts:211 (boundsOf)
- scenario: argType `control: { type: 'number', min: 0, max: Infinity }` (or `max: NaN`). `!usable(max)` returns `{}`, so the finite `min: 0` is lost too and the control accepts negatives, though the docstring says the bounds kept are "each one given finite". Only the unusable bound should be dropped (min kept as `.min(0)`), with the warning naming the dropped one.
- evidence: read
- severity: low

## Files read
packages/forge/src/actionParamSchema.ts
packages/forge/src/cli/cli.ts
packages/forge/src/cli/parse.ts
packages/forge/src/cli/policy.ts
packages/forge/src/config.ts
packages/forge/src/csf/argsContext.ts
packages/forge/src/csf/argsToSchema.ts
packages/forge/src/csf/loadCsfModule.tsx
packages/forge/src/csf/portSafe.ts
packages/forge/src/csf/propArgTypes.ts
packages/forge/src/csf/shims/preview-api.ts
packages/forge/src/csf/types.ts
packages/forge/src/icons.gen.ts
packages/forge/src/index.ts
packages/forge/src/kitIcons.tsx
packages/forge/src/messageOf.ts
packages/forge/src/pbt.fixture.ts
packages/forge/src/play.ts
packages/forge/src/protocol/channel.ts
packages/forge/src/protocol/messages.ts
packages/forge/src/protocol/schema.ts
packages/forge/src/route/url.ts
packages/forge/src/test/index.ts
packages/forge/src/test/play.ts
packages/forge/src/test/runStory.tsx
packages/forge/src/testing/frame.ts
packages/forge/src/testing/loupe.ts
packages/forge/src/testing/shell.ts
packages/forge/src/title.ts

<!-- done: 3 findings, files read: 29 -->
