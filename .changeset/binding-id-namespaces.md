---
"@weasel-js/routing": patch
---

An action's own binding with no declared id is now `<action>@<n>` for a binding override, where it
was `<action>#<n>`; a contribution's stays `<entry>#<n>`. An entry and an action sharing an id no
longer answer to one override.
