---
'@weasel-js/diagram-formats': patch
---

Writing a Mermaid class diagram quotes a generic class name, such as `Foo<List<?>>`, whose tildes would not read back as written.

<!-- entry: fix -->
