---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

The eyedropper samples through chrome, and an exclusive claim no longer warns on a press its owner takes later.

- The eyedropper's click consults the hit, so an exclusive chrome claim (a measurement under `measurementsContribution`, a selection handle) leaves it in contention and the active or held tool outranks the chrome's ambient binding. Before, a click on a measurement with the eyedropper active picked the measurement and sampled nothing. The dispatcher no longer reports an exclusive claim as dead at a press's eager `stage: 'press'` dispatch, where a claim owner binding only click and drag matches nothing: the press is dispatched again as the drag or click it settles into. Before, every such press logged `exclusive claim by "…" matched no binding` though the owner went on to take it.
