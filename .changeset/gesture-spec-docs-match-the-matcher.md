---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

Documentation only. `ModSpec` said only `shift` accepts `'optional'`; every modifier does. `DoubleClickSpec` quoted 500 ms and 5 px; the dispatcher uses 600 ms and 8 px. `TargetPredicate` said `hit` is the DOM target for gestures other than drag; it is the affordance hit for every gesture. `ActionsRegistry.activate` said a dispatcher activates its scope on focus; it does so on pointerdown and wheel.
