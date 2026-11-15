---
'@weasel-js/ui': minor
---

`Button` takes every native `<button>` attribute and handler, so it works as a disclosure trigger, a roving-focus member, or a form submitter.

`ButtonProps` now derive from `ButtonHTMLAttributes<HTMLButtonElement>` (exported as `ButtonDomProps`), omitting only what `Button` writes itself: `aria-pressed` (`pressed`), `aria-busy` (`loading`), `disabled`, and `aria-label`, which `iconOnly` still requires. A button held for a `disabledReason` ignores its press handlers and keeps its focus and key handlers.

```tsx
<Button aria-expanded={open} aria-controls="details" onClick={toggle}>Details</Button>
<Button tabIndex={active ? 0 : -1} onKeyDown={roveToolbar}>Left</Button>
<Button type="submit" form="order" name="intent" value="save">Save</Button>
```

<!-- entry: rank=10 new api -->
