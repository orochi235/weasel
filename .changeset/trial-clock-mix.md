---
'@weasel-js/labkit': patch
---

An instrument's `clock` takes `mix`, a factory for a blits mix that plays on the trial's clock. labkit keeps its mix time at the clock's `elapsed`, syncing it forward and seeking it back, so `<TrialTransport>`'s scrub and reverse reach a blits-driven trial. `useTrialMix()` reads it. Give the mix `history` with a `tape` (`@weasel-js/history`'s `createHistory`) reaching over the whole run.
