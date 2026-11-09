---
"@weasel-js/labkit": patch
---

A schema's `defaults()` now hands out a fresh copy of every list, object, and map default on each call, so no trial's config shares an array or record with the schema or with another trial.
