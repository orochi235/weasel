---
'@weasel-js/labkit': minor
---

A lab can keep its state in the URL hash as a versioned link, with `useHashLink` and the codec under `@weasel-js/labkit/link`.

`packLink(value, spec)` and `unpackLink(text, spec)` write and read `<version>.<base64url>` links. JSON is the default codec, and `spec.codec` takes a packed binary one. A link from a newer version is refused, with `dropped` naming what was lost. An older one goes through `spec.migrate`, and `spec.clean` checks what a link holds. `toBase64url` and `fromBase64url` come with it.

`useHashLink(value, apply, spec, { fallback, onReport, delay })` mirrors state the lab already keeps. It writes the hash with `replaceState` 250 ms after the last change, and it hands a pasted link to `apply`. A hash it cannot read is reported and never thrown. Writes never call `apply`, so undo and redo move the hash without adding steps. Start the state from `hashLink(spec)`:

```tsx
const [state, setState] = useState(() => {
  const read = hashLink(spec);
  return read?.ok ? read.value : DEFAULTS;
});
useHashLink(state, setState, spec, { fallback: DEFAULTS, onReport: showNotice });
```

<!-- entry: rank=10 new api -->
