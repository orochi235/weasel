---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Sidebar section titles are bold and take a `title-weight` stance slot, and
sidebar sections and forge's story tree have wider side gutters. labkit's
`h1`–`h3` defaults now sit in `:where()`, so a heading's own class sets its
font instead of losing to them.
