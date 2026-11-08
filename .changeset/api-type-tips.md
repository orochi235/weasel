---
'@weasel-js/forge': minor
---

Show a type's definition on hover in forge's API panel

- A name in a prop's, ref's or ref member's type that the project itself declares as an interface, type alias or enum is underlined, and shows its doc summary and its declaration (comments and `export` dropped, past 20 lines cut short with a count) on hover and on keyboard focus. Types from React, TypeScript's libraries and skipped packages are left as text.
- The `required` badge takes `--wzl-secondary-fg`, the secondary color meant for text, in place of `--wzl-secondary`, which failed color contrast on a light theme.

<!-- bump-approved: minor: maintainer — 1.18.0 release requested 2026-11-08 -->
