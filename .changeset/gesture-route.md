---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Add `GestureRoute`, which draws a dispatcher route string such as
`[initial] drag => node +shift` as a `Powerline`: phase, gesture, modifiers and
target as one chevron-linked chain. `gestureRouteSegments` returns the segments
on their own. labkit re-exports both through `@weasel-js/labkit/weasel-ui`.
