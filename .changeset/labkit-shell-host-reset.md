---
'@weasel-js/labkit': patch
---

A page built on `<LabShell>` no longer scrolls by the body's default margin

The host reset in `styles.css` zeroed the body margin only on a page that mounts
`<Lab>`. `<LabShell>` also fills the viewport, and without `.lk-lab` on the page
the body kept its 8px margin, so the page was 16px taller than the window. The
reset now applies to either.
