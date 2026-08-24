---
title: weasel
tagline: Domain-agnostic 2D scene graph for React
tags: [canvas, graphics, typescript]
featured: true
order: 20
media: { kind: component, src: weasel, span: 1, aspect: "3/4" }
---

A 2D scene-graph canvas kit that knows nothing about what you are drawing. Tools mutate the scene
through ops applied via `ctx.applyBatch`, which is what makes undo a property of the kit rather
than something every consumer reimplements.

Published as `@orochi235/weasel`. It is the scene layer under lbx-editor, and `packages/labkit`
in the same monorepo provides the widgets for self-contained interactive lab pages.
