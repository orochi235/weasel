---
'@weasel-js/icons-plugin': patch
---

Under `vite build --watch`, each rebuild now ships the glyphs its own modules name and reads every table afresh, instead of keeping every name and table an earlier build saw. A name deleted from the source no longer ships, and deleting one from both the source and its table no longer fails the rebuild.

Library mode annotates a recorded icon name in whichever chunk its literal lands, so a constant the bundler inlined into another chunk keeps its `@icon` annotation. The build now fails when any such literal has lost its annotation, not only when every one has, and names the ones that did.

A namespace import, a default import, or a re-export of `icon` from an `icons.gen` module now warns: the plugin does not follow those, so their calls go unrewritten.

The dev server finds a table in a directory named `fixtures`, which it used to skip, and a package that ships a `dist/package.json` with no `name` is read from its real root, so its declared table is found.
