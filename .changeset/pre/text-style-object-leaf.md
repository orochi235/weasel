---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A text node's style is one value, not ten sibling paths

`data.style.fontSize`, `.fontWeight`, `.align` and the rest addressed into one
`TextStyle` from ten independent leaves, each control writing a field of a
value it could only half see. `data.style` is an object leaf now, with
Character and Paragraph as groups inside it — groups head their fields and
contribute nothing to the path, so a field is still a field of the style and
one commit writes the whole thing.

An object leaf whose fields are entirely grouped no longer prints its own
heading, which would stack straight onto the first group's, and a group's
fields sit under a rule so the nesting reads. WeaselDraw's inspector descends
into an object leaf when listing what a kind exposes — the fields are the
editable surface; the leaf is the container.

`SelectionPanel` has a story now, which is how the two layout defects above
were found.
