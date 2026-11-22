# Audit round 67 — area `forge` (blind reviewer)

## listWithUnsent turns an `undefined` member's part into `null`, so a list edit can lose an unsendable sibling
- where: packages/forge/src/csf/portSafe.ts:148 (listWithUnsent)
- scenario: `parts` is built with `portSafePart(member)?.value ?? null`, the exact form `portSafePart`'s own array branch (line 105) says not to use, because an `undefined` member crosses as itself. So an original `undefined` member gets the part `null`, the same part as a member with no part at all (a function). Take an arg `[undefined, () => {}]`: it crosses as `[undefined, null]`. If the story or panel deletes the first entry, `sent` is `[null]`. Lengths differ, `sameKnob(null, parts[j])` now matches both j=0 and j=1, so `matches.length === 2` and `j` is undefined: the entry comes back as `null` and the function is lost. With `parts[0]` left as `undefined`, only j=1 matches and the function would be restored. Should be `const kept = portSafePart(member); kept ? kept.value : null`.
- evidence: read
- severity: low

## `control: { min, max }` without a `type` silently drops the bounds
- where: packages/forge/src/csf/argsToSchema.ts:268 (controlled, `case undefined`) with controlOf at :68
- scenario: a story with no prop-read argTypes writes `argTypes: { size: { control: { min: 0, max: 10, step: 1 } } }` over `args: { size: 4 }`. `controlOf` gives `{ type: undefined, min: 0, max: 10, step: 1 }`, which `controlled` treats as a choice control. With no options it falls to `structured(argType, value)` → `inferred(4)` → `f.number(4)`, and `min`/`max`/`step` never reach `bounded`. `warnUnusableBounds` stays quiet because the bounds are usable. The same bounds written with `type: 'number'` give a bounded control. Expected: a typeless control whose value (or `argType.type`) is a number goes through the `number` path, bounds included, or at least warns.
- evidence: read (Storybook's own merging of a typeless control object with the inferred control is inference, not checked)
- severity: low

## `weaselforge build --out <root>` builds into the vite root itself
- where: packages/forge/src/cli/policy.ts:21 (outDirPolicy)
- scenario: cwd `/repo`, config `root: 'site'`, `weaselforge build --out site`. `outDir === rootDir`, so `holdsRoot` is true. That only turns `emptyOutDir` off: the policy returns `ok: true`, and vite writes the built `index.html` and assets over the root's source files. The cwd gets a refusal for the same case (line 17). The docstring's "Never the root itself, or a directory holding it" reads as a refusal but is applied only to emptying. Expected: refuse an `--out` that is or holds the root, as for cwd.
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
