---
'@weasel-js/labkit': patch
---

`f.prefs(schema)` takes a property schema (`PrefSection`, its keys dotted paths) as an instrument's `config`: each leaf sits at the path its key names, each named top-level section heads its leaves, and the panel draws every leaf as `PrefsForm` would — a value in its stored unit, an option through its `encoding`, an `object` leaf whole. `defaults()` leaves an encoded leaf absent, since its default is the option it reads as. The schema lab's shape instrument declares its config this way, and its hand-written `prefsToFields` translation is gone.
