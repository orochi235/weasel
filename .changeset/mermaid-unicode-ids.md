---
'@weasel-js/diagram-formats': patch
---

Writing a Mermaid flowchart, block, kanban, or architecture diagram keeps an id in letters of any script, such as `café` or `日本`, as it is: those kinds read such ids, but the writer used to rename them to an ASCII spelling (`caf`, `_`). `mermaidIds` takes a `unicode` option saying the kind reads them; the kinds whose readers take only ASCII ids still rename them.
