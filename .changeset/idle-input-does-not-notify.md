---
'@weasel-js/routing': patch
---

Moving the mouse over an idle canvas re-rendered `<SceneCanvas>` once per mouse event, and each keystroke twice: the dispatcher notified its subscribers after every input, whether or not a gesture was in flight. `Dispatcher.subscribe` and `getVersion` now fire only for input that found or left a gesture in flight. A gesture's start, each pump, its end, and a cancel still notify, as does any other input handled while one is in flight.
