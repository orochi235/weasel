# Audit round 64 — ui.components.Menu

## The 16px end padding added to a menu label also lands on every menu-bar title, pushing its text off center
- where: packages/ui/src/components/Menu/Menu.module.css:59 (`.label`), packages/ui/src/components/Menu/AccessLabel.tsx:19 (AccessLabel)
- scenario: b2f905be3e added `padding-inline-end: var(--wzl-space-8)` to `.label` so a row's shortcut never sits close against its label. `AccessLabel` always applies `s.label` and appends a caller's `className`. `MenuBarTitle` (packages/ui/src/components/MenuBar/MenuBarTitle.tsx:40) renders `<AccessLabel … className={s.titleLabel} />`, and `.titleLabel` only composes `capText` (`text-box`), so it doesn't override the padding. Every menu-bar title ("File", "Edit", …) therefore gets 16px of empty space after its text, inside a button that already pads `var(--wzl-space-1) var(--wzl-space-3)` on both sides. The label sits visibly left of center, and the title's hit area and hover background grow by 16px at the end. It should get only the button's symmetric padding, as it did before the commit. The padding belongs to a menu *row's* label (`.row .label`, or a row-only class), not to every AccessLabel.
- evidence: read (git show b2f905be3e; MenuBar.module.css `.title`/`.titleLabel`; theme capText.module.css)
- severity: medium

## AccessLabel underlines by grapheme cluster, but an access letter is one code point, so a letter that ends up inside a multi-code-point cluster is never underlined
- where: packages/ui/src/components/Menu/AccessLabel.tsx:8-14 (accessSpan)
- scenario: `accessLetter` keeps the first *code point* of the composed access string (packages/menu/src/access.ts:7), and the menu matches a typed key against it that way (docs/unruled.md: "an access letter can be one" code point). `accessSpan` compares that against `foldText` of each whole *grapheme cluster* of the label. Wherever the letter's cluster has more than one code point after NFC, the comparison can never be equal. Take label "किताब" with access "क": the first cluster is "कि" (क + vowel sign ि). Typing क picks the row, but nothing is underlined. The same holds for access "कि", which `accessLetter` cuts to "क", for an emoji with a skin-tone modifier (access "👍🏽" → letter "👍", cluster "👍🏽"), and for a base letter carrying a mark with no precomposed form (e + U+0323 + U+0301 composes to ẹ + U+0301). The letter that works should be the one that's underlined: compare the cluster's first code point after folding, or the letter against the cluster's composed prefix.
- evidence: read
- severity: low

## A panel is placed once at mount and never again, so it overflows the viewport when its content later widens
- where: packages/ui/src/components/Menu/MenuPanel.tsx:351-373 (usePlacement)
- scenario: the layout effect measures `offsetWidth`/`offsetHeight` once (deps `[c, level, anchor]`), writes `left`/`top`, and records the rect with `c.setPanel`. A panel's width isn't fixed after mount:
  - A color row with no value shows "—", and after a pick it shows a swatch plus "#rrggbb".
  - A number row's `UnitField` is `width="fit"` and grows as digits are typed or set.
  - A text row's value changes too.

  Take a context menu opened near the right edge, where `placeMenu` put the panel flush against `innerWidth`. Pick a color in a row that showed "—", and the panel grows to the right past the viewport edge, clipping the value column. `c.setPanel` also keeps the old, narrower rect, so the controller's submenu-aim and hover geometry no longer match the drawn panel. The panel should be re-placed, or at least kept in bounds, when its size changes (a ResizeObserver on the panel re-running the same placement).
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Menu/AccessLabel.tsx
packages/ui/src/components/Menu/ContextMenuHost.stories.module.css
packages/ui/src/components/Menu/ContextMenuHost.stories.tsx
packages/ui/src/components/Menu/ContextMenuHost.tsx
packages/ui/src/components/Menu/Menu.module.css
packages/ui/src/components/Menu/MenuColorValue.tsx
packages/ui/src/components/Menu/MenuPanel.tsx
packages/ui/src/components/Menu/MenuRow.tsx
packages/ui/src/components/Menu/MenuValue.tsx
packages/ui/src/components/Menu/index.ts
packages/ui/src/components/Menu/menuParts.ts
packages/ui/src/components/Menu/menuUnder.ts
packages/ui/src/components/Menu/useContextMenu.ts
packages/ui/src/components/Menu/useDismiss.ts
packages/ui/src/components/Menu/useMenuPortal.tsx
packages/ui/src/components/Menu/useMenuTrigger.tsx

<!-- done: 3 findings, files read: 16 -->
