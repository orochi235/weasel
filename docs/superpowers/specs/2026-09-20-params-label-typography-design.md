# Panel label typography, inherited

**Status: designed, not built.**

For whoever implements this in `@weasel-js/ui` and `@weasel-js/labkit`. It answers one
question: where does a panel label's case, alignment and width get decided, now that four
components decide it separately and disagree.

## The problem

Every control in a labkit panel routes through a `*Row` from `@weasel-js/ui`, whose label
lands in `.rowLabel`. One thing does not: a pair cell (`ControlPanel.tsx`, the
`<span className="lk-pair-label">` beside a paired knob). No rule defines that class, so
those labels fall back to panel body text — sentence case, unstyled — beside uppercase
neighbors.

Where the recipe *is* defined it is copied, and the copies have drifted:

| Class | File | Tracking |
|---|---|---|
| `.rowLabel` | `ui/…/Properties.module.css` | `0.05em` |
| `.groupTitle` | `ui/…/Properties.module.css` | `--wzl-tracking-wider` |
| `.subpanelTitle` | `ui/…/Properties.module.css` | `--wzl-tracking-wider` |
| `.cardTitle` | `ui/…/Properties.module.css` | `0.04em` |
| `.groupTitle` | `ui/…/Prefs.module.css` | `0.04em` |
| `.objectGroup` | `ui/…/Prefs.module.css` | `0.06em` |
| `.subpanel .groupTitle` | `ui/…/Prefs.module.css` | cancels uppercase outright |

Copying is the only tool these have. `.rowLabel` is a CSS module, so labkit's plain Less
cannot reach it by name — a fact an in-tree comment already records, next to a fifth
hand-made copy of the recipe.

The existing `align` prop does not solve this. It is cross-axis (`baseline`/`center`),
drilled per row, and stops at the package boundary.

## The design

Three custom properties, declared on the panel root and consumed by every label:

```css
--wzl-params-label-case:  uppercase;  /* `none` cancels */
--wzl-params-label-align: start;      /* `end`, `center` — logical, for RTL */
--wzl-params-label-width: auto;       /* or a length: 7rem, 40% */
```

Custom properties inherit through the DOM. That is the whole reason for choosing them:
inheritance crosses the CSS-module boundary, the package boundary, and CSS/Less alike,
which no prop, class or context does. Overriding is redeclaring — on a panel, a group, or
one row — with no prop drilling and no `!important`.

**Defaults are today's dominant behavior**: uppercase, leading edge, content-width. A
consumer that changes nothing sees one change only — pair-cell labels stop being the
exception.

### Declare the defaults inside `:where()`

`:where(.panel) { --wzl-params-label-case: uppercase; … }`, not `.panel { … }`. `:where()`
contributes no specificity, so *any* consumer selector beats it and overriding never turns
into a specificity fight or an `!important`.

This is not hypothetical. The runtime theme sheet emits
`[data-wzl-theme][data-wzl-mode][data-wzl-density]` — (0,3,0) — and a consumer override
written at the same (0,3,0) ties and loses on source order, because adopted stylesheets
cascade after the document's own. A consumer hit exactly that when the density axis
landed: its token override stopped applying and the app silently fell back to the default
density, with nothing in the console. Defaults a consumer is *expected* to replace must be
cheap to outrank, and `:where()` is how this repo already does that in `theme/base.less`.

### Width is what makes alignment real

`text-align` does nothing while a label box is only as wide as its text, which is what
`.rowLabel` is on an inline row today. `--wzl-params-label-width: auto` therefore keeps
alignment inert; give it a length and every label in that panel shares one track, at which
point `-align` does visible work and the labels form a column.

### Scope differs by property

`-case` applies to every label role above. `-align` and `-width` apply to **row labels
only**: a group heading spans its row and has nothing to align against. Implement them on
`.rowLabel` and `.lk-pair-label`, not on the title classes.

### Migration

Each class in the table stops stating `text-transform`/`letter-spacing`/`text-align`
literals and reads the properties instead. `.subpanel .groupTitle` loses its
`text-transform: none` override and redeclares `--wzl-params-label-case: none` on the
subpanel root — same effect, now the sanctioned mechanism. `.lk-pair-label` gets a real
rule that consumes the properties rather than restating them; the uncommitted hand-copy
in `ControlPanel.less` is replaced, not extended.

Tracking values collapse to one. `0.04em`/`0.05em`/`0.06em` were drift, not intent.

## Verification

Three traps make the obvious checks worthless here.

**A vitest run cannot see this.** The CSS-module proxy in the `weasel-ui` project answers
to any key, so a component test proves a class was asked for, never that a rule defines
it. This spec's own predecessor shipped a stylesheet that did not parse with 123 green
tests over it. Parse the file with postcss directly, and check computed style in a
browser.

**`var()` inside a custom property resolves where it is declared.** Do not route a
mode-dependent color through one of these; `--wzl-fg-muted` belongs in the consuming rule.
`build-tokens.ts` guards authored tokens and explicitly does not cover hand-written CSS.

**labkit bundles its siblings** (`noExternal`), so a `packages/ui` edit does not reach
labkit's `dist` until the workspace rebuilds — and astv, which symlinks this checkout,
keeps showing the old behavior. Rebuild before judging a fix.

Add `scripts/check-labels.ts`, in the shape of the existing `check-controls` /
`check-spacing` gates: fail on a literal `text-transform` or `letter-spacing` in a label
class, so the fifth copy cannot come back.

## Not doing

Making these theme tokens in `weasel.json`. They are layout decisions belonging to a
panel instance, not palette; a consumer sets them on the element it owns. Revisit only if
a second surface needs the same set.
