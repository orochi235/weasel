---
'@weasel-js/plot': patch
'@weasel-js/ui': patch
'@weasel-js/diagram-formats': patch
---

Every plot kind can be authored from nothing, not only adjusted. Each kind has pure edits that insert, remove, and reorder every collection its spec holds (`insertPieSlice`, `insertXyRow`, `insertXySeries`, `removeGanttTask`, `insertTimelineEvent`, `insertQuadrantClass`, `insertGitCommand`, `insertSankeyLink`, `insertPacketField`, `moveRadarAxis`, …) and set the fields no drag reaches: titles, axes and their ends, chart options, a task's id, tags, start and end, a commit's every field. `moveGanttTaskToSection` moves a gantt task into another section, keeping its id and the dependencies on it. A removed or renamed gantt task id leaves every `after` and `until` that named it; a removed or renamed quadrant class leaves every point that used it.

`plotSchemaOf(data)` describes a spec of any kind as fields and tables of rows, a table holding tables of its own under each row (a gantt's sections hold their tasks), each read and write going through those edits, so a host builds a form or a grid knowing no kind. `plotRootContaining(scene, id)` names the plot a node is the root or a mark of. `setXyValue` now pads a series shorter than the chart's rows instead of throwing.

`@weasel-js/ui` adds `PlotDataPanel`, which renders that schema for one chart: a row per field, a grid per table with add (at the end, or after any row), remove and drag-to-reorder, rows opening onto the tables they hold.

`@weasel-js/plot` now exports `formatGanttStart`, `parseGanttStart`, `formatGanttEnd` and `parseGanttEnd`, which the Mermaid gantt reader and writer use.
