---
"@weasel-js/routing": patch
---

A drag can be the last operation. An ongoing action that declares `params` and whose gesture's handle has the new
`OngoingHandle.replay(params)` is kept when its commit leaves one history entry, so the last-operation panel can
change its params afterward: `adjust` undoes the entry, puts back the selection the drag started on, and has the
handle commit the gesture again with the new params, leaving one undo entry. An action whose gesture cannot be
recomputed leaves `replay` out and gets no panel. `Action.params` may also be a function answering the form for one
run from the params it resolved, or `null` for a run with nothing to show, and `LastOperation.label` is the form's
name where it has one. A run that commits live, coalescing into its own entry, now counts as one entry. A run made
while a journal is open on the history (path edit's, in an app that journals modes) is kept on that journal, where
before it was never kept; the journal committing, cancelling, or suspending ends it.
