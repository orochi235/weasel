---
"@weasel-js/text": patch
---

The wrap reads a tab followed by ink as part of that ink. A tab with a combining mark on it now counts toward the line's width rather than hanging, and where a line may break before a tab (after a space or a zero-width space) but not between the tab and the text after it, such as `!`, the wrap now breaks before the tab, so a line no longer starts with that `!`.
