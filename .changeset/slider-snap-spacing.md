---
'@weasel-js/ui': patch
---

`Slider` takes two new stop props. `snap: 'strict'` makes the stops detents: a drag or track press always lands on the nearest one. `spacing: 'even'` places the stops at equal intervals and runs the track from the first to the last, mapping values linearly within each gap — with the default magnetic snapping, a 0.25/0.5/1/2/4 rate track gets evenly spaced, labeled stops and can still rest at 1.3. Stops now attract by distance along the track rather than by value. `DetentSlider` is a strict `Slider` underneath, and stays as the way to put text values (Off/Low/High) on a slider. Stop labels now hang from the track, so an inline readout no longer shifts them off their stops.
