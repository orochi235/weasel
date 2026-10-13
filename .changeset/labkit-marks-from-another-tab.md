---
'@weasel-js/labkit': patch
---

Fixes: marks drawn on a trial in another tab never appeared in this one, and this tab's next mark then saved over them. A trial built its mark store once from its record and never read the record again. When the record's marks change under it, by another tab's write, the trial now builds its store again from them.

Decided on an agent's judgment, of the three ways the entry offered: the store is rebuilt, not merged mark by mark, so this tab's mark undo history ends there, as its state history already does on such a write, and a mark this tab drew within the quarter second before the write, not yet saved, is dropped with it. A write from another tab that changed no mark keeps the store and its history. An instrument that keeps its marks in its own `annotations.storage` is not touched.
