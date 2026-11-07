---
'@weasel-js/diagram-formats': patch
---

Writing Mermaid lost text that Mermaid reads as markup: a label holding `&amp;` or `&#65;` came back as `&` or `A`, and one wrapped in backticks came back as a markdown string with the backticks gone. The writer now spells such an `&` as `#38;` and such a leading backtick as `#96;`.
