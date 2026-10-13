---
'@weasel-js/labkit': patch
---

A presented lab can be held still for a poster, and worked from its host page.

Adds API: `<Lab still>` — or `?still` in the page's URL — presents the lab with every clock paused where it opens, and `still={1200}` or `?still=1200` holds them 1200 ms in. A still shows no play controls and reads and writes no storage, and the lab's root gains the class `lk-lab--still-ready` once that frame has been drawn, for a capture to wait on.

Adds API: a presented lab answers `labkit:play`, `labkit:pause`, `labkit:seek`, and `labkit:query` messages posted to its window by the window around it or by its own page, and posts a `labkit:state` message back as it starts, on every change to its clock, and when asked. `<Lab messages>` names the lab, limits the origins it takes messages from, or turns the channel off; it is on by default. The types are `PresentationCommand`, `PresentationState`, and `PresentationMessageOptions`.

Changes behavior: the speed and direction a pause comes back to, and whether anyone has worked the clock by hand, are kept per clock, where each `<TrialTransport>` kept its own. Two transports over one clock now agree, and a transport that remounts no longer replays a run its visitor had already stopped.
