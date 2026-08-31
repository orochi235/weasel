---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Give every control one height, and stop labkit styling weasel-ui by load order

`--wzl-control-h` described itself as the height of a button, input or select
and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
apart unnoticed. The four controls read the token now and the token is 24px,
which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
onto `--wzl-control-h` — a segmented control is a control, not the strip a row
of them sits in — and its `height` prop writes a private variable so setting it
cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
that *contains* controls, and 24px there would clip the focus ring of a 24px
control inside it.

In labkit, a class handed to a weasel-ui component through `className` landed
beside that component's CSS-module class at equal specificity, so whichever
stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
so a component always paints its own controls, and deliberate overrides carry a
`.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
had stretched over its own buttons, hiding the leading "10" of "100%".

Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
never been visible; a trial's config panel was crushed to 60px of a 270px panel
by its sidebar extras; and the lab header wrapped to three lines because a
`Select` swallowed the row's slack while the mode toggle compressed past its own
labels.

`LabProps` gains `footer`, which had no route short of building `LabShell`
yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
bare string, so a layer can carry a label distinct from its canvas id and be
marked `alwaysOn` — both already honoured by the layer list, neither
expressible. Existing `string[]` declarations still typecheck. `Instrument`
gains a third type parameter for a job's item type, which had been pinned to
`never`; TypeScript infers all three or none, so a `defineInstrument` call that
names state and config must name the item type too.
