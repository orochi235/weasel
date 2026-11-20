---
'@weasel-js/forge': minor
---

An isolated story's `.enableIf()` written as code now disables its row in the workshop's panel, and a `.resettable()` group keeps its reset.

The frame answers the predicate for each config, as it answers `showIf`. `ConfigAnswers` gains `disabled` and `DescribedEntry` gains `gated` and `resettable`.

<!-- entry: fix api -->
