I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole findings document is below.

# Audit round 59: ui.components.Select

## `value` / `defaultValue` / `onChange` / `selectionMode` reach React Aria and override the kit's key handling
- where: packages/ui/src/components/Select/Select.tsx:59 (the `SelectProps` Omit list), :169 (`{...rest}` onto `RACSelect`)
- scenario: `SelectProps` omits `selectedKey`, `defaultSelectedKey` and `onSelectionChange`. It does not omit React Aria 1.22's `value`, `defaultValue`, `onChange` or `selectionMode`, so all four are typed as accepted and spread onto `RACSelect`. react-stately's `useSelectState` reads `props.value !== undefined ? props.value : props.selectedKey` (useSelectState.mjs:34), so `value` beats the kit's `selectedKey`:
  - `<Select value="g" mixed>` shows "g" instead of `Mixed`.
  - On a held select (`disabledReason` / `readOnly`), `onChange` still fires for closed-trigger arrow keys and typeahead. The `held`/`pick` gate only wraps `onSelectionChange`.
  - Typeahead landing on a disabled option reaches `onChange`.
  - `defaultValue="g"` is silently dropped. The kit always passes a controlled `selectedKey` (`ownKey`, which starts as null), so the trigger shows the placeholder.
  - `selectionMode="multiple"` type-checks and breaks the `(key: T) => void` contract.
- evidence: read (node_modules/react-stately/dist/private/select/useSelectState.mjs:34, :40)
- severity: medium

## Adding or removing `tooltip`/`shortcut` remounts the trigger button, which drops focus and orphans the held-pick key listener
- where: packages/ui/src/components/Select/Select.tsx:185-205 (`TriggerTooltip` around `RACButton`), :162 (`useHeldPick(SelectStateContext, triggerRef)`)
- scenario: `TriggerTooltip` returns `children` bare when the content is undefined and wraps them in `<TooltipTrigger>` otherwise. When `tooltipContent({tooltip, shortcut, …})` switches between undefined and defined, the element type above `RACButton` changes and React remounts the `<button>`. Example: `tooltip={key === 'b' ? 'hint' : undefined}`, then ArrowRight on a focused closed trigger.
  - Focus falls to `<body>` in the middle of the keyboard interaction.
  - `useHeldPick`'s capturing `keydown` listener was attached once to `triggerRef.current`, and its effect deps (`[trigger]`, a stable ref object) never change. It stays on the detached button, so `lastKey` stops updating. A later closed-trigger ArrowLeft/Right onto a disabled option is then dropped instead of stepping past it.
  - `ButtonTooltip` explicitly keeps "the same wrappers whatever the state" to avoid this. The Select path does not.
- evidence: read (packages/ui/src/components/Tooltip/buttonTooltip.tsx:101-112; heldItem.ts:89-95)
- severity: medium

## In an RTL document, the "over" list is shifted sideways by the difference between list and trigger width
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:76-93 (`AlignOverTrigger` crossOffset)
- scenario: `crossOffset` is computed on the assumption that `placement="bottom start"` puts the list's left edge on the trigger's left edge (comment at :76-77). React Aria translates `start` by direction: under `dir="rtl"`, `bottom start` aligns the right edges, giving `left = seat.right − box.width + crossOffset`. For a list wider or narrower than its trigger, the selected row lands `box.width − seat.width` px away from the trigger's value. The values are stated against each element's own box, so the next pass computes the same numbers and the error never corrects. It should line the selected row up with the value.
- evidence: read (react-aria calculatePosition `position[crossAxis] += crossOffset`; start→right in RTL)
- severity: low

## On touch, a quick tap on the selected row right after opening is swallowed
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:106-119 (pointerup guard)
- scenario: React Aria opens a Select on press start for mouse but on release (`onPress`) for touch. On touch the opening tap's `pointerup` has already passed by the time `AlignOverTrigger` mounts and adds its one-shot capture listener. The next `pointerup` then gets swallowed (`preventDefault` + `stopPropagation`) if it comes within `longPressMs` of the opening `pointerdown` and within `dragPx` of it. That is exactly where the selected row sits, since the list lands over the trigger. Tap the trigger, then quickly tap the highlighted row: the tap is eaten and the list stays open. The guard exists only to absorb the opening click's own release, which on touch never reaches it.
- evidence: read
- severity: low

## `data-align` is never cleared when the over-trigger list loses its selected row while open
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:59-63, :70
- scenario: The list is open over the trigger, so `data-align` is set. A controlled consumer then sets `selectedKey={null}` (or the selected option is removed from `options`). The effect takes the `BELOW` branch and returns without deleting `popover.dataset.align`. The list now hangs below the trigger, but `.popover:not([data-align])` (Select.module.css:116) no longer applies, so it loses `min-width: var(--trigger-width)`. With `--wzl-select-align: right` its rows also stay end-justified.
- evidence: read
- severity: low

## Option values `1` and `'1'` get the same React key
- where: packages/ui/src/components/Select/Select.tsx:291 (`renderOption`, `key={String(o.value)}`)
- scenario: `OptionKey` is `string | number`, and React Aria treats `1` and `'1'` as different ids. `options={[{value: 1, …}, {value: '1', …}]}` gives two siblings the key `"1"`. React warns and can reuse or drop one row's element across updates, while the collection keeps both ids.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Select/Select.fontOptions.stories.module.css
packages/ui/src/components/Select/Select.fontOptions.stories.tsx
packages/ui/src/components/Select/Select.module.css
packages/ui/src/components/Select/Select.stories.module.css
packages/ui/src/components/Select/Select.stories.tsx
packages/ui/src/components/Select/Select.tsx
packages/ui/src/components/Select/alignOverTrigger.tsx
packages/ui/src/components/Select/index.ts
packages/ui/src/components/Select/listbox.module.css
packages/ui/src/components/Select/optionLabels.tsx

<!-- done: 6 findings, files read: 10 -->