---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Adds API: `motifs.titlebar()`, a frame motif with a solid title strip across the top, the way a desktop window is titled. The strip is the frame's edge color, or its tone where it names one. A theme repaints it through new override hooks: `--wzl-titlebar-surface` (a color, a gradient, or stripes), `--wzl-titlebar-fg`, `--wzl-titlebar-align`, `--wzl-titlebar-weight`, `--wzl-titlebar-label-surface` and `--wzl-titlebar-label-pad` (a patch behind the title, so stripes do not run through the letters), and `--wzl-titlebar-border` and `--wzl-titlebar-inset` for the frame's edge, which also takes `--wzl-bevel-raised`.

Adds API: `<DefaultMotif motif>`, which names the motif every `MotifFrame` and `PropertyGroup` below it draws in when given none. A motif stays a caller's choice, not a token, so this is how an app sets a theme's titled groups in that theme's frame. That a theme does not pick the motif itself was decided on an agent's judgment.
