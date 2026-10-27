---
'@weasel-js/clock': patch
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.
