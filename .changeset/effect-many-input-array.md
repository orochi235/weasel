---
'@weasel-js/diagram': major
---

`runPipeline` hands an evaluator a `many` input as an array of every reached wire's value. A bypassed stage passes the first one on.

An evaluator for a stage with a `many` input reads `inputs[port]` as `unknown[]` instead of one value.

<!-- entry: breaking fix -->
