---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

An inline Properties row puts its control under the label when the label would leave the control too narrow to use.

A slider wraps when its track would fall below `--wzl-prop-track-min` (64px), keeping its readout beside the track; a number or text field, select, dialog trigger or segmented toggle wraps below `--wzl-prop-field-min` (6ch) or its segments' own width. Rows that fit lay out as before. This covers labkit's `ControlPanel` two to a row and a two-across `PrefsForm`, whose slider slot now holds the same track floor. `--wzl-prop-readout-reserve` sets how much room a slider counts for its readout.

<!-- entry: behavior visual api -->
