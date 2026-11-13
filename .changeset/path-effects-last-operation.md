---
'@weasel-js/path-tools': minor
---

Making a blend, bend, repeat, text along a path, roughen, zigzag, or pucker and bloat leaves its settings in the last-operation panel, where a change remakes it in place.

Each effect's settings are one form, `PATH_EFFECT_PARAMS[kind]`, which the making action declares as its `params` and `editPathEffect`'s settings form shows as a section, so a new effect's defaults and the ones the form shows are the same values. Every number in them now has a range.

<!-- entry: new api -->
