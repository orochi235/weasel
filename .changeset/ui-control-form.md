---
'@weasel-js/ui': major
---

`ControlForm` names where a control is drawn, and `FormScope` sets it for what is inside: `'bar'`, `'menu'`, `'row'`, `'popover'`, or `'palette'`.

`Bar` sets `'bar'`, its overflow `'menu'`, its popovers `'popover'`, and `ToolGroup` `'palette'`; `useControlForm()` reads it. `ControlPlace` is gone: `enumControlAt` and `PARAMS_ENUM_PLACES` take a `ControlForm`.

```ts
// before
enumControlAt(field.control, 'popover' as ControlPlace);
// after
enumControlAt(field.control, 'popover' as ControlForm);
```

<!-- entry: breaking api -->
