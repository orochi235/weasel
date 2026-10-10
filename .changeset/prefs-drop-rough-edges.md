---
'@weasel-js/ui': patch
---

`PrefsForm` slides its rows, groups, and rail entries to their new places when a `drop` changes, where they used to jump, and a row picked up slides to where it would land. The slide takes `--wzl-motion-fast` and is skipped under reduced motion. `prefDropTargetAt` reads rows where they will lie, not where a slide is drawing them.

A `PrefDrop` takes `where: 'home'` for a drag with nowhere to land: each node of `from` is drawn as a placeholder where it sits, and `path` is not read. `PrefSchemaEditor` draws that for a row dragged off every target, which used to go back to full strength until it found one.

`prefDropTargetAt` no longer answers with a row hidden under its section's stuck title: a point on the title drops into the section.

The rail layout's pane keeps room for its scrollbar (`scrollbar-gutter: stable`), so a placeholder that makes the pane scroll does not narrow the rows.
