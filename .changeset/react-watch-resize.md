---
'@weasel-js/react': minor
---

`watchResize(targets, onResize, options?)` calls `onResize` whenever one of the elements given resizes.

It hands on the observer's entries and returns the function that stops watching.

`targets` is one element or an iterable of them; a null among them is skipped. Where `ResizeObserver` is absent (jsdom, older embedders) it watches nothing and returns a no-op, so take a first reading yourself when you need one.

<!-- entry: rank=0 api -->
