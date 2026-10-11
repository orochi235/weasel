---
'@weasel-js/core': patch
---

The built-in pen tool numbered its nodes from a counter that restarted with each `<SceneCanvas>` mount, so the first path drawn after a reload, a remount, or on a second canvas over the same scene was `pn-1` again and the insert threw an id collision. Pen node ids now carry a random suffix, like every other id the kit mints.
