---
'@weasel-js/routing': patch
---

Lifting a finger after a long-press fired also dispatched a `click` at the same point, so whatever click does there ran underneath the menu the long-press had just opened, and moving the finger before lifting started a drag. A press whose long-press (or its `contextMenu` fallback) was handled now produces neither. A hold that fired nothing still clicks on release.
