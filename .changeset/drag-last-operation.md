---
"@weasel-js/routing": patch
---

A drag can be the last operation. An ongoing action that declares `params` and whose gesture's handle has the new
`OngoingHandle.replay(params)` is kept when its commit leaves one history entry, so the last-operation panel can
change its params afterward: `adjust` undoes the entry, puts back the selection the drag started on, and has the
handle commit the gesture again with the new params, leaving one undo entry. An action whose gesture cannot be
recomputed leaves `replay` out and gets no panel. `Action.params` may also be a function answering the form for one
run from the params it resolved, or `null` for a run with nothing to show. A run that commits live, coalescing into
its own entry, now counts as one entry.
