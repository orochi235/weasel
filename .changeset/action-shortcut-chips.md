---
'@weasel-js/core': patch
---

Add `actionShortcuts(action)` — an action's keyboard bindings, flattened into
the shape `formatShortcut` / `formatShortcutParts` render.

Binding lists are written for a matcher, not a reader, so two things collapse:
a spec's `key` may list spellings of one keycap (`['[', '{']` — the shifted
bracket reports as `'{'`), and a modifier declared `'optional'` matches held or
unheld, so it isn't part of what anyone presses. Non-keyboard bindings have no
chip form and are skipped.

Every keyboard binding is returned, in declaration order — an action can answer
to several (`reorder.forward` has three) and nothing marks one canonical.

WeaselDraw's command palette shows its shortcut chip again. It had been
suppressed since `Action.defaultBinding: KeyBinding` was removed, pending a
formatter for the replacement shape.
