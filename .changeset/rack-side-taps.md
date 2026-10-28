---
'@weasel-js/diagram': patch
---

The `rack` look no longer draws a wire through the stages it passes. A wire from a stage's main output into the side input of a stage further down the line, past at least one stage, now leaves from a tap on the source's side-stage edge, a port named `~tap:<output>` spread among that edge's side ports, so its curve runs beside the line. `EffectEditor` maps the drawn edge back to its wire, and a run reads it as the output it taps.
