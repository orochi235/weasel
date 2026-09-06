---
'@weasel-js/ui': patch
---

`Select` and `NumberField` take `width='fit'`, sizing to their content instead
of to the row they sit in.

Both are form fields and both drew at `width: 100%`, which is right in a form
column and wrong everywhere else: in a shrink-to-fit row — a toolbar, a header —
the field absorbs all the slack and pushes the row's other content to
min-content. The only fix available to a consumer was to pin a pixel width from
its own stylesheet, which is a number nobody can maintain against a font or a
label change.

`width` defaults to `'fill'`, which is the behavior every existing caller has.
`'fit'` sizes the control to its content:

- A `Select` measures its widest option, not its selected one. The trigger
  becomes a grid, and a hidden stack of every option label (the placeholder
  included) shares a cell with the value. So the control fits the longest thing
  it can ever show and does not change width as the selection moves. The
  children form is measured the same way, off each `SelectItem`'s label. Each
  measured row carries the check mark too, because a selected row's mark
  travels into the trigger alongside its label.
- A `NumberField` states a character count, `--wzl-number-field-width`,
  defaulting to `9ch` — the width the property rows already use for a number.
  A stated width is what this needs: left to size itself an `<input>` asks for
  its 20-character intrinsic width, which is wider than most rows it sits in.

This is the same affordance the property rows got through
`--wzl-prop-number-width` / `--wzl-prop-text-width`, offered as a prop because
these two are placed by consumers rather than by a panel.
