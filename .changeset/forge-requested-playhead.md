---
'@weasel-js/forge': patch
---

A story that sets its timeline span at runtime now opens at the time a URL's `t` or the trial's persisted playhead asks for, even when that time lies past the span declared before `setSpan` ran. The asked-for time is placed afresh in every new span until play, a seek, a scrub or a new `t` moves the playhead, and until a span can hold it, neither `t` nor the persisted playhead is rewritten. Before, the time was clamped to the placeholder span and the clamped value was written back.
