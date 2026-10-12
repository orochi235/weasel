---
'@weasel-js/ui': patch
---

Changes behavior: a `Timeline` given no `transport` draws the time readout and the Graph switch alone. It drew Play, Loop, and Rate wired to nothing. `transport={false}` still hides the row. Decided on an agent's judgment: the readout and the switch work without a transport, so they stay.
