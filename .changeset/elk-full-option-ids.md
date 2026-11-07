---
'@weasel-js/diagram-elk': patch
---

An ELK option passed in `layoutOptions` under its full `org.eclipse.elk.` id now replaces the one `rootOptions` derives under its `elk.` id. Both used to reach ELK side by side, so `org.eclipse.elk.direction: 'DOWN'` with `direction: 'right'` ran downward while a group's minimum width was still given for a rightward run, across the wrong axis. `rootOptions` now writes such ids under their `elk.` alias.
