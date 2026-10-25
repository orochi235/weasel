---
'@weasel-js/diagram': patch
'@weasel-js/diagram-formats': patch
---

Add UML class and ERD stencils and diagram types to `@weasel-js/diagram`. The `uml` group holds class, interface, abstract class, package, note, actor, use case, and component; the `erd` group holds entity, weak entity, relationship, and attribute. The `umlClass` type routes new connectors orthogonally to an open arrowhead, and `erd` draws them from `crow-one` to `crow-many`.

A body takes a new `divider` row, a rule across its content box that the outline painter draws in the body's own stroke, and a row's text style can now be `italic`. A built body records each row's height, so `bodyFollower`, a new transform follower, lays a resized body's rows out again inside its new box. `DiagramStencil` takes `padding`, `gap`, and `verticalAlign`. Two outlines are added: `component` and `doubleRect`.

`@weasel-js/diagram-formats` reads divider rows back from a scene, leaves them out of DOT, Mermaid, and draw-style XML text without a warning, and writes and reads an italic row in draw-style XML.
