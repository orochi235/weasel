---
'@weasel-js/labkit': major
'@weasel-js/forge': major
---

`<Lab>` takes the rows its settings panels draw as `renderers`, the name `<ControlPanel>` and `<PrefsForm>` give them; `controls` is gone.

The same rename reaches `useLabContext().renderers` and a forge shell config's `renderers`.

```tsx
// before
<Lab instruments={instruments} controls={{ vector2: Vector2Row }} />
// after
<Lab instruments={instruments} renderers={{ vector2: Vector2Row }} />
```

<!-- entry: breaking -->
