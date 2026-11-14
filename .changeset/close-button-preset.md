---
'@weasel-js/ui': major
---

`CloseButton` is gone; spread `CLOSE_BUTTON_PROPS` into a `Button` for the kit's close, dismiss, or remove button.

The preset is a small icon-only ghost button with `emphasis: 'low'`, showing the `close` glyph, exported from `@weasel-js/ui/components/Button`. It takes `aria-label`, `tooltip`, `disabled`, `disabledReason`, `className`, and a ref as `Button` does. It is the `sm` icon button (`--wzl-control-h-sm` square) where `CloseButton` was `--wzl-icon-button-size`.

```tsx
// before
<CloseButton aria-label="Close dialog" onClick={close} />
// after
<Button {...CLOSE_BUTTON_PROPS} aria-label="Close dialog" onClick={close} />
```

<!-- entry: breaking api visual -->
