---
'@weasel-js/text': patch
---

`layoutRuns` with a `bidi` engine analyzed text containing line breaks as one paragraph, so punctuation opening a line could jump to the wrong end because of the line above it, and an unclosed override or embedding kept applying after the break. Each hard-broken line is now its own paragraph, and under `direction: 'auto'` takes its direction from its own first strong character.
