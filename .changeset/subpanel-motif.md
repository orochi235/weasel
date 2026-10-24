---
"@weasel-js/ui": patch
"@weasel-js/theme": patch
---

`Subpanel` takes a `motif`, as `PropertyGroup` does, along with `leading` and `actions`. Its own look is now the `divider()` motif, and its rows sit in a body element inside the frame. A `<MotifFrame>` has a `kind`, `'group'` or `'subpanel'`, and `<DefaultMotif>` names a default for each: `<DefaultMotif group={titlebar()}>` titles a desktop theme's groups without turning its subpanels into windows.

Breaking: `<DefaultMotif motif={…}>` is now `<DefaultMotif group={…}>`, and the `.subpanelTitle` class is gone.
