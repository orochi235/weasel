---
'@weasel-js/animator': patch
---

A seek that lands short of an event already booked with no stop handle leaves that booking standing instead of booking the event a second time.

<!-- entry: fix -->
