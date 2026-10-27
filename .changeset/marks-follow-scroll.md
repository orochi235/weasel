---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Marks on a forge story now belong to its scrolled content: they move with it as the story scrolls, and an export
pictures the whole content rather than the top of it.

Adds API to labkit: an annotation target can declare `shown`, the part of its content box its element shows (for a
scroller, its scroll offset and its own size), and `fitView` takes it as an optional third argument. A target is
asked for again whenever anything inside its element scrolls.

Fixes `toWeaselView` and `fromWeaselView`, which copied labkit's pan (a screen translation) into weasel's `x`/`y`
(the world point at the corner) unchanged. A target whose camera pans, and a target cut off by a clipping ancestor,
drew and stored its marks in the wrong place.

Marks a forge story already had were placed against the story's box; on a story taller than its trial they now land
against the content instead.
