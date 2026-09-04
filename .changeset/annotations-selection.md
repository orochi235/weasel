---
'@weasel-js/labkit': patch
---

Let a host read and set which marks are selected.

This adds API. `AnnotationsApi` grows `selection()` and `setSelection(ids)`,
in the same `<target>/<node>` ids the rest of the surface uses, merged across
every target — the question "which mark did the user just click?" had no public
answer, so a host could draw marks and query them but could not respond to one.

There was nothing to build: the overlay's `<SceneCanvas>` per target already
runs weasel's own selection, and weasel keeps a canvas's selection on the scene
rather than in React. The store already holds those scenes, so it reads and
writes selection directly and the overlay is untouched. Click, marquee, handles
and undo's selection restore all come along for free.

A selection change already reached `subscribe` for the same reason — a scene
notifies its listeners on `setSelection`. Its doc comment now says so.

An id naming a target or a mark that is not there is dropped, matching how
`update`, `setMeta` and `remove` ignore one.
