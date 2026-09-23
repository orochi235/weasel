---
'@weasel-js/ui': patch
---

`Select` can group its rows into titled sections. In the children form, wrap `SelectItem` rows in the new `SelectSection` with a `title`; in the `options` form, an entry with `title` and its own `options` is a section (type `SelectOptionGroup`) and can sit beside plain options. Sections render as React Aria list-box sections, so each is a group named by its title for screen readers, and neighboring sections divide on a rule. A `width="fit"` trigger measures the options inside sections too.
