---
'@weasel-js/text-dom': patch
---

The in-place text editor keeps a run's `stroke` and `rotate` through an edit. Before, its overlay had no place for either, so committing an edit dropped them from every run. The overlay does not draw them: a run's stroke and turn ride on its span as `data-stroke` and `data-rotate`. A `data-fill` or `data-stroke` that pasted markup carries and that is not JSON is now ignored rather than throwing.
