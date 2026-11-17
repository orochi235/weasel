---
'@weasel-js/ui': patch
---

Transport and PlayheadReadout write and speak the playhead's time in the `I18nProvider` locale.

It matches the rate readout, and a time before zero takes a true minus sign.

<!-- entry: fix -->
