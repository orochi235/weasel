---
"@weasel-js/core": patch
---

`<Canvas redrawOn>` compares its sources element by element, so an inline `redrawOn={[source]}` no longer unsubscribes and resubscribes on every render. Layer subscriptions and `redrawOn` subscriptions are now held by separate effects, so a layer change no longer churns the `redrawOn` ones either.
