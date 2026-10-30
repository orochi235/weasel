---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A typed field can commit once typing rests, as well as on blur or Enter. The new `typing.settleWhenIdle`
kit setting, on by default, makes every typed number and text control commits its draft after `typing.idleMs`,
800 ms unless set: `PropertyControl`'s and `PropertyField`'s number and text kinds, `UnitField`, and so every
typed row of labkit's `ControlPanel`, `PrefsForm`, and `SelectionPanel`. A control's own `settleWhenIdle` prop
overrides the setting. The field keeps the text as typed through the commit, and a number commits only text that
reads as a value inside its bounds, never an offset (`+=5`), leaving the rest for blur. Escape after a pause puts
back the value last committed. `useIdleSettle` and `IDLE_SETTLE_MS` are exported for a field of an app's own.
