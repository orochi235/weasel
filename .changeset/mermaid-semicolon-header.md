---
"@weasel-js/diagram-formats": patch
---

Mermaid detection and reading no longer throw a `TypeError` on text whose first statement starts with `;`: detection says it is not Mermaid, and reading reports the line.
