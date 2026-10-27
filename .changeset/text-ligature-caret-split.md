---
'@weasel-js/text': patch
---

A shaped ligature spanning several letters (`fi`, Arabic lam-alef) splits its advance evenly across them, so a caret between two of its letters stops inside it rather than at its end. Each letter's first code point takes a share; right to left, where the opening letter is drawn rightmost, its glyphs shift left so the ligature lands where the shaper put it.
