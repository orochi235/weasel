---
'@weasel-js/labkit': patch
---

A trial remembers its title and which of its sections are folded.

Both were in-memory only: a retitled trial reverted to its instrument's name on
reload, and every fold reopened on remount. They now live on the trial record —
`TrialRecord.title` and `TrialRecord.collapsedSections` — so they persist with
everything else the lab writes. Both are optional, so a document written before
this loads unchanged.

`TrialChromeContext` gains `collapsedSections` and `setSectionCollapsed`, the
pair a contribution reads and writes. A sidebar section is keyed by its
contribution id; a section inside one — a control panel's property groups — is
keyed `<contribution id>/<label>`. A section with no entry sits at its own
`defaultCollapsed`.

Sidebar sections are now controlled rather than holding their own state, and
the built-in Settings panel's groups fold: it passes `collapsed` and
`onCollapse` through to `ControlPanel`, which is what puts a twisty beside each
group heading.
