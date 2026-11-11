---
'@weasel-js/diagram-formats': patch
---

Mermaid's ER, class and state writers drop, with a warning, a row, member or line their readers would refuse.

That is an ER row that is not a type and a name, a class member that is blank or a lone `}`, and a blank line past a state's name.

<!-- entry: fix -->
