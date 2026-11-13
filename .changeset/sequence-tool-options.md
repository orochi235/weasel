---
'@weasel-js/diagram': major
---

What each sequence tool adds is a tool option and its action's params, so the last-operation panel can change a drawn message's arrow.

`SequenceToolsOptions` drops `participant`, `arrow`, `fragment` and `mark`. Each is an option of its tool (`SEQUENCE_PARTICIPANT_OPTIONS` `kind`, `SEQUENCE_MESSAGE_OPTIONS` `arrow`, `SEQUENCE_FRAGMENT_OPTIONS` `type`, `SEQUENCE_MARK_OPTIONS` `mark`), kept in the `toolOptionValues` dep. `<DiagramView toolOptionValues>` publishes one.

```tsx
// before
const tools = useSequenceTools({ commit, arrow: () => arrow });
// after
const values = createToolOptionValues();
setToolOption('diagram.sequence.message', SEQUENCE_MESSAGE_OPTIONS, values, 'arrow', 'reply');
<DiagramView tools={useSequenceTools({ commit })} toolOptionValues={values} … />
```

<!-- entry: rank=5 breaking api -->
