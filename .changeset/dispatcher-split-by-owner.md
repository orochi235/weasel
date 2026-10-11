---
'@weasel-js/routing': patch
---

Internal: `dispatcher.ts` is split by owner. The dev trace, the candidate ranking, the trace-record projection, and the dispatcher's public interfaces each live in a module of their own beside it, and everything it exported is still exported from it. No behavior change.
