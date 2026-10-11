---
'@weasel-js/ui': patch
---

In a `PrefsForm` rail, choosing a nested entry under a page that was not open did nothing but mark the entry for a moment. It now opens that page and scrolls to the section. `useScrollSpy`'s `scrollTo` no longer reports a section it could not find as the one in view.
