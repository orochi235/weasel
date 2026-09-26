---
"@weasel-js/labkit": patch
---

labkit depends on windease 2. labkit never used the APIs windease 2 removed (`hasFocus`, `canAccept`, `overflowMode: 'unplace'`), so nothing changes for a labkit consumer. A consumer importing windease directly alongside labkit now resolves the 2.x line.
