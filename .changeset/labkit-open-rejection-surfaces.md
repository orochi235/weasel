---
'@weasel-js/labkit': patch
---

A stored `<Lab>`, `SingletonExperimentProvider`, or `<Persistence>` whose open rejected (an unknown `defaultInstrument`, an instrument `deserialize` that throws on its stored state) showed its fallback forever and reported only an unhandled promise rejection. The error is now thrown from render, so an error boundary catches it the way it catches the same failure in a lab with no `storageKey`.
