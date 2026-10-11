---
'@weasel-js/audio': patch
'@weasel-js/diagram': patch
'@weasel-js/font': patch
'@weasel-js/labkit': patch
'@weasel-js/routing': patch
'@weasel-js/select': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
