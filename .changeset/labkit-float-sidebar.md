---
"@weasel-js/labkit": patch
---

`<Lab sidebar="float">` puts each trial's sidebar in a panel over its body, opened from its title bar, so the body keeps its whole width.

The toggle is a Trial settings button (contribution id `panel`, so `suppress={['panel']}` drops it), and the panel closes on Escape or a press outside it. `'dock'` stays the default. `<Trial>` takes the same `sidebar` prop, and its chrome options are exported as `TrialChromeOptions`.

<!-- entry: rank=5 new api -->
