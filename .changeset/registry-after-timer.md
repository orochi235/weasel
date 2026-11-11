---
"@weasel-js/editor": patch
"@weasel-js/registry": patch
"@weasel-js/d3": patch
---

`@weasel-js/registry` adds `after(ms, fn)`, a timer that waits out any delay. That includes one past the 2³¹ − 1 ms a single timer holds. D3 transition delays use it, and `@weasel-js/editor` and `@weasel-js/d3` now depend on `@weasel-js/registry`.

<!-- entry: new api -->
