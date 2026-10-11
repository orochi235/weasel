---
'@weasel-js/registry': patch
'@weasel-js/modes': patch
'@weasel-js/core': patch
---

`@weasel-js/registry` exports `createEmitter()`, one subscribe/notify pair with stated semantics: a pass calls the listeners held when it began, one unsubscribed before its turn is skipped, and a listener that throws is reported to `console.error` without stopping the others or throwing into the store. The reflectable registry, modes' scoping layer and decorations, and core's pose overrides, pose feed, layout reflow, parallax plane, and key state are built on it. For those stores, a listener that subscribes during a notify now waits for the next one, and a throwing listener no longer aborts the notify.
