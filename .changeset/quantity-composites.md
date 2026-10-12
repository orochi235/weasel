---
'@weasel-js/quantity': patch
---

Adds API: a range and a vector of quantities have a presentation of their own. `presentRange(from, to, fallback?)` gives `1/64–1/2` as text, spoken text (`1 over 64 to 1 over 2`), and HTML, and `presentVector(members, fallback?, { labels })` gives `x 3, y −4`. `rangeParts` and `vectorParts` return the same as one run of parts. Each member shows under its own display, else the fallback.

In the HTML form a composite is a `<span data-composite="range">` or `"vector"` holding one `<data value>` per member, with a `separator` part between and a `label` part before a labeled member.

Decided on an agent's judgment: a unit or percent sign both ends of a range share is written once, after the second (`2–5ft`, `25–50%`); the en dash is spaced when either end is negative (`−5 – −2`); and a composite has no MathML form.
