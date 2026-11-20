---
'@weasel-js/loupe': patch
---

A loupe model throws a `TypeError` when its surface's `sample` answers with a promise.

An asynchronous sampler, one with a WebGPU readback in its stack, goes to `createEyedropperModel` alone; a loupe's surface samples with one that answers at once.

<!-- entry: fix behavior -->
