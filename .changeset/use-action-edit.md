---
'@weasel-js/ui': minor
---

`useActionEdit` gives a slider, a range, or any editing control the callbacks that run an ongoing action, so one drag is one undo step.

```tsx
const edit = useActionEdit('setStrokeWidth', ([t]: readonly Thumb[]) => ({ width: t.value }), [{ value: width }]);
<Slider min={1} max={20} thumbs={edit.shown} onInput={edit.onInput} onChange={edit.onChange} onCancel={edit.onCancel} />
```

`onInput` begins the action on a drag's first move and moves it after, `onChange` ends it, and `onCancel` ends it unkept, so no `coalesceWindowMs` is needed to merge the drag. `shown` is the value to draw: where the drag has reached while it runs, since the action previews on the canvas. A key step is a run, and an undo step, of its own. It is exported from `@weasel-js/ui/components/ActionEdit`.

<!-- entry: rank=10 new api -->
