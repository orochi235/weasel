---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Show an option's description, and why it is disabled, in every form an enum draws

- A pref enum option's `description` and `disabledReason` now reach its select, radio and menu forms, not only its toggle. `Radio` takes `description` and `disabledReason`, drawn after its label and read as its accessible description, and `MenuButton`'s `items` take the same two fields.
- labkit's `ConfigOption` takes `description` and `disabledReason`, so `f.enum` options and forge's global pins carry them.
- A tool stack's menu row reads its tool's `description` as its hint.
