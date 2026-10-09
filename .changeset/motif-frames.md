---
'@weasel-js/ui': patch
---

`MotifFrame` is a titled frame around anything, drawn in a motif: how a frame draws its title and its edge. Five ship: `rule()` (a title between two rules), `stereo({ side, labelAlign })` (a label bar along any edge, as on the back of an A/V receiver), `notch({ align })` (the title cut into a fieldset's border), `tab({ align })` (a folder tab), and `plaque({ mix })` (the tone fills the frame, with text and controls redrawn in black or white to read on it). Every motif colors itself from the same `stance` and `tone`, and the root is a `group` named by its title. The root barrel exports the factories as `motifs.stereo()` and so on; `@weasel-js/ui/components/MotifFrame` exports the bare names, along with `withMotifClass` for writing a motif of your own.

`PropertyGroup` now draws through `MotifFrame` and takes a `motif` prop. Its default, `rule()`, is the look it had before. Its root is now a `group` named by its title, so a `getByRole('group')` query that once found only a list's other groups can find it too.
