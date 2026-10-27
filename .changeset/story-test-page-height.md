---
'@weasel-js/forge': patch
---

`runStory` gives a story with no `viewport` the page's height, as the workshop's stage fills its preview. Under an
auto height a story that fills its host was laid out 0 tall, and a lab there looped its ResizeObservers.
