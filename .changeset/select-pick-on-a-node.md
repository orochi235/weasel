---
'@weasel-js/core': patch
---

Fixes: an always-live `pointerDown` binding never fired on empty canvas while the select tool was active. `select.pick` matched every press off chrome, found nothing to pick there, and still took the press at the active tier. Its binding, and `select.collapseDeferred`'s, now match a press on a node only, so a press on empty canvas reaches the binding a tier below.

Behavior change, made on an agent's judgment: a consumer whose own always-live `pointerDown` binding has no target now sees presses on empty canvas under the select tool, where it saw none. A press on a node still goes to the tool. A bare `useSelectTool` with no `classifyTarget` wired has no body class to read and behaves as before.
