---
'@weasel-js/ui': patch
---

`ListEditor`'s own text entries (no `renderEntry`) now hold what is typed until blur or Enter, or until typing rests where `typing.settleWhenIdle` is on, like every other typed field, instead of calling `onChange` on every keystroke. In `PrefsForm` and `SelectionPanel` list leaves a typed entry is now one write, and in a panel one undo step. Enter writes the typed entry and the new one as a single change, Backspace in an entry typed empty removes it, Escape drops the draft, and a move carries the typed text with its entry. A new `settleWhenIdle` prop overrides the kit setting.
