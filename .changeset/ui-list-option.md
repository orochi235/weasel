---
'@weasel-js/ui': major
---

`Select`, `ComboBox`, and `MenuButton` take one option type, `ListOption`, in place of `SelectOption` and `ComboBoxOption`.

A `ComboBox` option now draws its `icon`, `description`, and `disabledReason` as a `Select` option does. `MenuButtonItem` is a `ListOption` whose label is text, and `AsyncOption` is a `ListOption`.

```ts
// before
import type { SelectOption } from '@weasel-js/ui';
const options: SelectOption[] = [{ value: 'r', label: 'Red', isDisabled: true }];
// after
import type { ListOption } from '@weasel-js/ui';
const options: ListOption[] = [{ value: 'r', label: 'Red', disabled: true }];
```

<!-- entry: breaking api -->
