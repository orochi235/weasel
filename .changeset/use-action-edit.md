---
'@weasel-js/ui': minor
---

`useActionEdit` gives a slider, a range, or any editing control the callbacks that run an ongoing action, so one drag is one undo step.

```tsx
const width = useActionEdit('setStrokeWidth', ([t]: Thumb[]) => ({ width: t.value }));
<Slider thumbs={[{ value }]} min={1} max={20} {...width} />
```

`onInput` begins the action on a drag's first move and moves it after, `onChange` ends it, and `onCancel` ends it unkept, so no `coalesceWindowMs` is needed to merge the drag. A key step is a run, and an undo step, of its own. It is exported from `@weasel-js/ui/components/ActionEdit`.

<!-- entry: rank=10 new api -->
