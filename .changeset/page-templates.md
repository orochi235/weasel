---
'@weasel-js/diagram-formats': patch
---

`PAGE_TEMPLATES` holds a new page of every kind a document holds: an empty graph page for each diagram type, in its
notation; a small sequence diagram; and a small chart of each plot kind. `templateSpecs` draws a template as a new
one-page document, with the diagram type it names, and `addTemplatePage` adds one as another page of a scene, what it
draws included, as one undo entry. `pageSpecs` draws any one document page placed as a scene's page list would place
it. This adds API.
