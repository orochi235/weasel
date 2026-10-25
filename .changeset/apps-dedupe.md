---
"@weasel-js/devtools": patch
---

Add `RegistryBrowser`, the Registry tab's screen as a component of its own: a filter field over a tree of host-supplied categories (optionally grouped), beside a detail pane the host renders. The Registry tab is now built on it, so its filter matches through ui's `filterTree`, drops categories with no match, and opens every branch with one; its filter field is named "Filter registry", and its category counts are badges.
