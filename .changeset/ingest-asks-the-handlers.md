---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A canvas refuses a drag no content handler would claim, and leaves a paste none claims to the page. The `ingest` action asks the handler registry before it takes a drop or a paste; `clipboard.pasteEvent` asks its one handler, so on a canvas that edits and does not ingest, pasted text that is no copied node is no longer swallowed.

New API. `Action.enabled` takes a third argument, `carried`: the items of the drop or paste being routed, which the dispatcher passes in prediction and in dispatch. `ContentHandlerEntry.types` lets a handler with a predicate `match` say which MIMEs it could claim; a drag still in flight shows its MIMEs and no contents, so a predicate cannot be asked about it.

Behavior change for a consumer handler: while a registered handler has a predicate `match` and no `types`, no drag with a known MIME is refused, since it might take anything. Declare `types` to let the canvas refuse the rest. The kit's handlers declare theirs.
