---
'@weasel-js/labkit': patch
---

`ControlMatrix` cells no longer blur their backdrop. They inherited labkit's default button blur, and with dozens of them in one panel Chrome flickered the panel and the page header around it.
