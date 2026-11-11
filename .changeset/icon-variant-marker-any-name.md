---
"@weasel-js/icons-plugin": patch
---

An app build fills in a `virtual:weasel-icons/<name>` module whatever its name holds. A custom variant or namespace named with a quote, a backslash, or a lone surrogate had left its placeholder unreplaced, and the module threw when it ran.
