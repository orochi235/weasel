# labkit presentation mode — design

**What this is:** arc 2 of labkit presentation mode, the mode itself: an existing `<Lab>`
shown as one trial with no chrome, for embedding. Play controls and gestures are later arcs
(`docs/TODO.md`). **Status: being built on `presentation-mode`; delete at merge.**

**Who it's for:** whoever implements it. Assumes labkit's lab/trial runtime.

## API

```tsx
<Lab instruments={…} defaultInstrument="rose" storageKey="rosee"
     present                                   // or ?present in the URL
     seed={{ instrument: 'rose', config: {…}, state?, view? }} />

const { active, enter, exit } = usePresentation();   // inside <Lab>; throws outside
```

| Entry | Store | Trial shown | Escape / `exit()` |
|---|---|---|---|
| started presenting (`present` or `?present`) | `${storageKey}:present`, or unstored without a key | the seeded trial | `exit()` leaves to the full lab on the same store; Escape does nothing |
| `enter()` at runtime | the lab's own, still persisting | the focused trial, live | both return to the workspace untouched |

- `seed` is read only when the lab starts presenting. Elsewhere it is ignored, with a
  dev warning. Without one, the trial opens on `defaultInstrument`'s defaults.
- `seed.config` goes through `addTrial`'s config seed, so Reset returns to it.
- The presentation store remembers a fingerprint of its seed (stable JSON). A different
  fingerprint at mount replaces the stored trials with one opened on the new seed, so an
  author's change reaches returning visitors; an unchanged one keeps the visitor's state.
- `?present` is a bare flag. An app wanting an embed per URL parses its own URL into `seed`.

## Rendering

One tree. Presenting sets `data-lk-present` on the lab root; CSS hides the shell, palette,
panes, other tiles and the presented trial's chrome (`display: none`, so nothing unmounts
and canvases keep their GL contexts across a round trip), and hidden regions are `inert`.
The presented `<Trial>` marks its own root `data-lk-presented` from context, and its
content fills the lab. Annotation marks still draw.

`lab/presentation.less`:

- `:root:has(.lk-lab[data-lk-present])` gets `color-scheme: normal` and a transparent
  background: an iframe whose root scheme differs from its embedder's is painted opaque.
- `.lk-lab[data-lk-present]` drops the nebula backdrop. The lab keeps its own mode's
  `color-scheme`, so its controls keep their look.

## Structure

`Lab.tsx` is split as this lands: `openLab.ts` (store opening, seeding, `:present` key,
fingerprint), `useLabSurface.ts`, `useFocusPick.ts`, `nebula.ts`, and `presentation.tsx`
(context, `usePresentation`, `?present`).

## Testing

| Check | Where |
|---|---|
| `:present` key, seeding, fingerprint reseed / keep | unit, memory adapter |
| `?present`, `usePresentation` outside `<Lab>`, Escape only after `enter()` | jsdom |
| presented tile fills the lab, chrome has no box, `html` transparent with `color-scheme: normal`, same canvas element after enter→exit | browser test |
| screenshot over a colored host page | browser, posted to the wall |

Also: a terse `apps/site/demos/PresentationDemo.tsx`, a `patch` changeset, the TODO entry
cut to what is left, and a TODO entry to move agnew and rosee onto `<Lab>`.
