---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`ToggleBar`, `OptionsBar`, and `ButtonBar` are one `SegmentedBar`, whose `mode` says what a press does.

`mode` is `'single'` (the default) or `'multiple'` for what `ToggleBar` did, `'each'` for `OptionsBar`'s items that own their own state, and `'momentary'` for `ButtonBar`'s buttons. Each mode keeps its old roles: a radio group (or a group of toggle buttons with `followsFocus: false`), a group of toggle buttons, and a toolbar of plain buttons. The bar lives at `@weasel-js/ui/components/Segmented`. `ToggleBarItem` is `SegmentedBarItem`, an `'each'` item is a `SegmentedEachItem`, and a `'momentary'` one a `SegmentedMomentaryItem`; `ToggleBarVariant`, `OptionsBarVariant`, and `ButtonBarVariant` are `SegmentedVariant`, and the three `*_BAR_VARIANT_ICONS` are `SEGMENTED_VARIANT_ICONS`. labkit re-exports `SegmentedBar`, `SegmentedBarItem`, `SegmentedBarProps`, and `SegmentedVariant` in place of the `ToggleBar` names.

```tsx
// before
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
<ToggleBar aria-label="Align" items={items} value={v} onChange={setV} />
<OptionsBar aria-label="View" items={[{ value: 'grid', label: 'Grid', selected, onChange }]} />
<ButtonBar aria-label="Edit" items={[{ value: 'undo', label: 'Undo', onAction: undo }]} />
// after
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
<SegmentedBar aria-label="Align" items={items} value={v} onChange={setV} />
<SegmentedBar mode="each" aria-label="View" items={[{ value: 'grid', label: 'Grid', selected, onChange }]} />
<SegmentedBar mode="momentary" aria-label="Edit" items={[{ value: 'undo', label: 'Undo', onAction: undo }]} />
```

<!-- entry: rank=10 breaking api -->
