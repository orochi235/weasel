---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

An inline Properties row whose label would leave its control too narrow to use now puts the control under the label instead: a slider when its track would fall below `--wzl-prop-track-min` (64px), with its readout kept beside the track, and a number or text field, select, dialog trigger, or segmented toggle below `--wzl-prop-field-min` (6ch) or its segments' own width. Rows that fit lay out as before. This covers labkit's `ControlPanel` two to a row and a two-across `PrefsForm`, whose slider slot now holds the same track floor. `--wzl-prop-readout-reserve` sets how much room a slider counts for its readout.
