# Audit round 66 — forge (blind reviewer)

## configKey writes every Map and every Set as `{}`, so configs differing only inside one share a key
- where: packages/forge/src/protocol/messages.ts:134 (configKey)
- scenario: `tagged` only rebuilds arrays and plain objects; a Map or Set (both accepted by `isPortSafe`, so both can be config values on the port) passes through to `stableStringify`, whose `Object.entries` sees no entries. Configs `{ m: new Map([['a', 1]]) }` and `{ m: new Map([['a', 2]]) }` get the same key, so answers computed for one (hidden / errors / disabled / resolved) are applied to the other, and a frame-local arg's `over` (`coverOf`, argsContext.ts:16) keeps applying after the config under it changed. It should write the entries, as it already does for non-finite numbers.
- evidence: read (messages.ts, packages/core/src/core/stableStringify.ts)
- severity: low

## isPortSafe passes a Date, RegExp, ArrayBuffer or typed array whole, own expando properties included, which a port drops
- where: packages/forge/src/csf/portSafe.ts:58 (isPortSafe)
- scenario: `CLONED_WHOLE.has(proto)` returns true without the `hasOnlyClonedKeys` / member check the Map, Set and plain branches apply. An arg `Object.assign(new Date(0), { label: 'epoch' })` or a `Float32Array` given a `meta` field is reported port-safe; structuredClone carries only the internal data, so the frame receives a bare Date / typed array. Because `isPortSafe(original)` is true, `withUnsent` (line 113) returns the sent copy rather than putting the lost fields back, so the story renders with them missing. The function's contract ("delivers `value` as the same thing it was") says it should return false (or let `portSafePart` keep the original in the frame).
- evidence: read
- severity: low

## useArgs sends an update to a forge-reserved key over the port, where the shell drops it, and keeps no local copy
- where: packages/forge/src/csf/shims/preview-api.ts:29 (useArgs → updateArgs)
- scenario: a story calls `updateArgs({ $globals: … })` (or any key `isForgePath` matches) with a port-safe value. updateArgs removes any local entry for it and calls `setConfig`; frameLink.ts:159 discards a `setConfig` on a forge path, so the update vanishes: neither config nor the local overlay ever holds it, and the story's args never change. A key the shell will not accept should stay frame-local like a non-port-safe value does.
- evidence: read (preview-api.ts, shell/frameLink.ts:157-160)
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
