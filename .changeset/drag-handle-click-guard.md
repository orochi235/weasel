---
'@weasel-js/core': patch
---

After a `useDragHandle` drag that ended away from its source (dropped on a zone elsewhere, dropped on nothing, or canceled), the next click on the source row did nothing: the listener that swallows the click a drag would otherwise deliver was still armed. It is now removed when the drag is canceled, and right after a release that brought no click.
