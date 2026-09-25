---
'@weasel-js/labkit': patch
---

`annotations.tools` chooses which annotation tools a lab's rail offers, by id (`AnnotationToolId`: `pointer`, `select`, `stroke`, `line`, `arrow`, `rect`, `ellipse`, `text`). The rail is shared across the lab, so it carries the union of what each annotating instrument names, in the kit's order; an instrument that leaves `tools` unset still asks for all of them. A lab starts in `pointer` when its rail has it, and otherwise in the first tool the rail carries.
