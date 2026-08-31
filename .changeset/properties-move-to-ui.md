---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Move the property-panel components from `@weasel-js/labkit` to
`@weasel-js/ui`. `PropertyPanel`, `PropertyList`, `PropertyRow`, `SliderRow`,
`NumberRow`, `TextRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`,
`Subpanel`, `PropertyGroup`, `CurveField` and `EffectCard` imported nothing
from labkit's instrument, config, state, trial or lab layers — they are
generic form UI, and a consumer who wanted them had to take labkit and its
lab frame to get them.

They can now be imported from `@weasel-js/ui` directly. **Existing
`@weasel-js/labkit` imports keep working**: labkit re-exports the whole set,
and it bundles weasel-ui into its own dist, so this is a re-export rather
than a new dependency.

The class names are no longer public. The stylesheet moved from global
`lk-`-prefixed Less to CSS modules, matching the package it joined, so
`lk-property-panel`, `lk-property-list__span` and their neighbours no longer
exist as targetable selectors. Code reaching them from its own stylesheet
should pass `className` instead — `PropertyPanel`, `PropertyList` and
`PropertyRow` all accept one. For full grid width, a row takes `PropertyRow`'s
`span` prop, and anything that is not a row goes in `<PropertySpan>`.

`formatNumber` and its helpers consolidated onto weasel-ui's existing
`format/number`; labkit's duplicate is gone.
