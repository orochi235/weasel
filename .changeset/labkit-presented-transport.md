---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

labkit: a presented trial whose instrument declares a `clock` gets play controls along its bottom — play and pause, speed and loop, and for a seekable clock with a duration a scrub bar over the current pass and a reverse switch. Space plays and pauses, the arrows step, Home and End jump, R reverses and `<` / `>` change speed. A run that ends plays again after three seconds until a visitor touches the controls, and they hide in a presented box narrower than 480px. `<Lab transport={false}>` leaves them off. The same controls are `<TrialTransport trialId? keys? replay? />` for any lab chrome. A `TrialClock` now says its `duration`, whether it is `seekable`, and whether its run has `ended`.

ui: `TRANSPORT_RATES`, the rates `<Transport>` offers, is exported.
