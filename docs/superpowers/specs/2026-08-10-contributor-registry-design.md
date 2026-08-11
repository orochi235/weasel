# Contributions: one registry, declared eligibility, and claims that outrank scope

Design for widening the kit's model of a **tool** into a **contribution** — a
registry entry that declares what it contributes and when it is eligible for
input. A focus-driven tool becomes one case of it. For anyone working on the
tool registry, the gesture dispatcher, `@weasel-js/hud`, or a feature that wants
to ship as one export instead of four.

The change has two halves that have to share a vocabulary. **Source side** is
who is listening: today three hardcoded slots plus a second, unrelated
eligibility mechanism in `@weasel-js/modes`. **Target side** is what the pointer
landed on and who owns it: today an `AffordanceHit` that degrades to a bare
string when a registered layer produces it. They meet at one word — *claim* —
which currently means three different things and is typed as none of them.

## Why now

Three open TODO items and two shipped workarounds are the same missing concept.

`@weasel-js/hud` is not a tool, so `createHudTool` ends with
`as unknown as Tool<null>` (`packages/hud/src/tool.ts:150`) — a bindings-and-actions
object cast into a record whose other fields are all about being a focus-driven
mode. It mounts as *ambient*, alongside viewport pan/zoom and the near-vestigial
rotate tool, three entries that share a slot for unrelated reasons.

A HUD widget resolves a CSS cursor per zone and nothing reads it, because a
widget is not a registry entry and the hit it produces cannot carry one.

And a HUD window will not drag while `rect` is active, because seven builtin
tools bind a bare `{ kind: 'drag' }` with no target predicate. `select` got a
narrow fix (`{ kind: 'drag', target: 'empty' }`); the other six did not, and
copying the predicate six more times would be six copies of a workaround.

## The fact that shapes everything

`matchSorted` iterates scope tiers outermost (`interactions/dispatcher/matcher.ts:167`):

```ts
for (const scope of SCOPE_PRIORITY) { /* hotkey, active, ambient */ }
```

**Scope dominates specificity.** Any `hotkey` binding beats every `active`
binding; any `active` binding beats every `ambient` one. Specificity only
orders bindings *within* a tier. So no target predicate the HUD writes can win:
it is ambient, and ambient is last.

That is why the seven bare-drag tools are not a per-tool bug. A model in which a
precisely-targeted binding cannot outrank a vague one in a higher tier will keep
producing this defect.

## Contribution

```ts
interface Contribution {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
  overlay?: RenderLayer<unknown>;
  affordances?: AffordanceSource;
  cursor?: string | ((ctx: ToolCtx) => string);
  presentation?: ToolPresentation;
  def?: unknown;
}
```

Every role is optional and independent. `createHudTool` returns a legal
contribution with `bindings` + `actions` and no cast.

`Tool<TScratch>` remains exported and remains the word for a focus-driven mode.
It is `Contribution` with `eligibility.focus` set, plus the
fields that only mean something for one: `initScratch`, `onActivate` /
`onDeactivate`, `previewPose`, `previewBounds`, `previewIds`. Those fields
describe a mode the user switches into and a gesture it holds scratch across —
they are not general to a registry entry, and moving them onto one would make
every contribution answer questions it has no business answering.

`affordances` is new on the record. It is how a contribution declares the chrome
it owns, so the claim it produces can name it (below). Today the kit's own
affordances are assembled inside `buildAffordanceAt` and a consumer's arrive as
registered layers — two paths to the same place.

## Eligibility

Eligibility is a **set of conditions**, not one mode. The hand tool is
palette-selectable *and* engaged by holding space; both hold at once.

```ts
interface Eligibility {
  /** Selectable as the focused entry — exclusive, one at a time. */
  focus?: boolean;
  /** Also live while this key is held. */
  offhand?: HotkeyTrigger;
  /** Live regardless of what is focused. */
  always?: boolean;
  /** Live only for input this entry's own affordances produced. */
  claimed?: boolean;
  /** Modality filter, applied wherever it would otherwise be live. */
  capabilities?: CapabilityTag[];
}
```

The scope tier a binding matches at is *derived* from whichever condition is
live at dispatch time — `offhand` → hotkey, `focus` → active, `always` /
`claimed` → ambient. `BindingScope` and its ordering survive unchanged; what
changes is that the tier is computed from a declaration instead of from which
argument the consumer passed the entry in.

**`offhand` becomes load-bearing.** Today `ToolDef.hotkey` is declared, read by
the inspector, and wires nothing — its own doc says setting it "does NOT
automatically engage the held-key behavior." The behavior lives in the
consolidated `tool.offhand` action, which the host registers separately via
`buildToolOffhandBindings` + `BUILTIN_OFFHAND_ACTIONS`. Assembly is the place
that can read the declaration and register that binding, which is the whole
point of declaring it.

`claimed` is the condition that does not exist today. The HUD approximates it by
mounting ambient and repeating a `{ kindOf: isHudHit }` guard on all three of
its bindings — a filter applied three times at match time that belongs once on
the entry. Declaring it also makes a contribution that claims but contributes no
affordances catchable at assembly rather than as silence at runtime.

**Capabilities fold in here.** `Tool.capabilities` +
`eligibleForMode(mode, tags)` is already an eligibility axis, answering "when is
this usable" in a system that answers the same question with slots. Two answers
to one question is how the HUD ended up ambient. `capabilities` becomes a filter
on `Eligibility` composed with `mode`, and `@weasel-js/modes` keeps
`eligibleForMode` — its predicate is unchanged; what changes is where the tags
are read from. `eligibleTool(reg, tool)` widens to accept a contribution
(`ToolLike` already asks only for `{ id, capabilities }`). Call sites are
`ToolPalette.tsx:148`, `actions/defaults/toolActivate.ts`, and
`tools/useKeybindings.ts`.

## Claims

An `AffordanceHit` becomes the record of *who owns this point and how strongly*:

```ts
interface AffordanceHit {
  kind: string;
  owner: string;          // contribution id
  strength: 'exclusive' | 'shared';
  cursor?: string;
  // targetIds / anchor / fixedPoint / payload unchanged
}
```

`cursor` is already declared on `AffordanceRegion` and already consumed by the
hover-cursor pump via `AffordanceHit.cursor` — it works for kit chrome and is
simply dropped on the registered-layer branch, which builds its hit by hand
(`canvas/SceneCanvas.tsx:2255`):

```ts
return { kind: `layer:${extra.layerId}`, ...(payload) };
```

Widening the layer hit-test contract so a layer returns a claim rather than a
`{ layerId, binding }` pair is what makes a registered layer a first-class
affordance producer. A HUD widget's resolved cursor then reaches the host by the
same path the resize handles already use.

`strength: 'exclusive'` is `hud.window()`'s "claim every interior press",
promoted from a widget-level workaround to something the dispatcher understands.

**Not in this design:** which gesture *kinds* a region accepts. A widget cannot
author bindings, so double-click, wheel and long-press on widgets is hud growing
more bindings and `HudPointerEvent` growing more arms. The widened record makes
that cheap; it does not do it. That remains the second half of the P2 "cursor
and gesture dispatch over HUD elements" item.

## Precedence

**An exclusive claim outranks the scope tier.** `matchSorted` gains a pre-pass:
when the event carries a claim with `strength: 'exclusive'`, only bindings whose
spec names that claim's owner or kind are eligible; scope ordering then applies
within that filtered set exactly as it does today. Shared claims and unclaimed
events are untouched.

This is what deletes select's `target: 'empty'` patch and the six copies nobody
wrote. The seven bare-drag tools need no edits — their bindings are fine, and it
was the precedence model that let them swallow presses they never named.

It is a real behavior change, so it owes the argument `targetRank`'s doc comment
makes for its own addition: enumerate the bindings whose resolution changes and
show they are only the intended ones. The enumeration belongs in the
implementation plan, backed by a matcher test table.

## Assembly and reflection

`useContributions({ entries })` assembles the registry: eligibility state, the
overlay roll-up `useTools.getActiveOverlays` does today, and the binding set the
dispatcher matches against.

It also folds in actions' `defaultBinding`s, which `ActionsRegistry` assembles
separately today. That closes the recorded gap where `reportRouteConflicts` sees
tool bindings and never action defaults, so a tool binding colliding with an
action's default goes unreported: `findScopedConflicts` needs a second input,
and this is the first place that has both.

## Bundles

A bundle is `Contribution[]`. `useLoupe()`, `useHud()` and the den packs return
entries the consumer spreads; `mergeContributions(...)` owns id collision and
ordering. The recorded `WeaselPlugin = { tool?, layers?, behaviors? }` shape is
this list — its deferral condition (at least two plugin-shaped features in
flight) is met several times over by hud, loupe, pen, the debug overlay and the
den packs.

## Migration

`useTools({ active, registry, ambient })` keeps working: `registry` entries get
`focus: true`, `ambient` entries get `always: true`. A builtin that declares
`ToolDef.hotkey` gets `offhand` — and gets it wired, where today the host
registers the offhand binding by hand. `Tool.capabilities` moves onto
`eligibility.capabilities`; nothing else on a builtin tool changes.

The two `@weasel-js/hud` changes are the point of the exercise: `createHudTool`
drops its cast and declares `claimed: true`, and its three bindings drop the
repeated `kindOf` guard.

## Testing

- **Matcher table** — claim strength against scope tier, covering the
  enumeration the precedence change owes.
- **Eligibility** — extend `dispatcher.eligibility.test.ts` for the four
  conditions, their combinations (focus + offhand on one entry), and the
  capability filter.
- **Assembly** — conflict reporting now sees a tool binding colliding with an
  action `defaultBinding`.
- **Integration, and the reason to believe it** — a HUD window drags while
  `rect` is active (fails today), and a resize band shows `nwse-resize` (shows
  the active tool's cursor today).

## Sequencing

Two plans. Claims and precedence first: they are testable in isolation, they
close both HUD P2s, and they put the vocabulary through a real case before it is
frozen into a public record shape. The contribution record, eligibility,
assembly and bundles follow.
