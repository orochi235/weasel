---
'@weasel-js/labkit': patch
---

New `<LabRoot>`: the element every labkit component expects above it, on its
own. It carries `.lk-root` — the design tokens, the font stack, the box-sizing
reset and the element defaults a lab's bare markup is styled by — marks itself
the portal host for overlays, and applies a theme only when the app has not
already applied one.

Until now `.lk-root` was written in exactly one place, inside `<LabShell>`, so
a consumer mounting a labkit piece by itself — a bare `<Workspace>` or
`<ControlPanel>` — resolved no tokens and had to rebuild the contract from its
own stylesheet. Wrap it in `<LabRoot>` instead, beside
`import '@weasel-js/labkit/styles.css'`.

`<LabShell>` renders one rather than writing the class itself; nothing about
its output changes.
