---
'@weasel-js/ui': major
---

Kit components say `open`, `invalid`, `required`, `loading`, and `indeterminate`, never React Aria's `is`-prefixed names.

This is a breaking change. `Dialog`, `PrefsDialog`, `Popover`, `Callout`, `Tooltip`, `TooltipTrigger`, and `Select` rename `isOpen` to `open`; `isOpen` is no longer accepted. `Input`, `TextArea`, `NumberField`, `RadioGroup`, `Select`, `ComboBox`, and `Checkbox` rename `isInvalid` to `invalid` and `isRequired` to `required`. `Checkbox` renames `isIndeterminate` to `indeterminate`. `ComboBox` renames `isLoading` to `loading`, and `useAsyncOptions` returns `loading` in place of `isLoading`, so its result still spreads into one. `defaultOpen`, `onOpenChange`, and `isSelected` keep their names.

```tsx
// before
<Dialog isOpen={open} onOpenChange={setOpen} title="Export">…</Dialog>
<Input label="Name" isRequired isInvalid={problem !== null} errorMessage={problem} />
<Checkbox isIndeterminate>Mixed</Checkbox>
<ComboBox label="Part" {...async} isLoading={async.isLoading} />
// after
<Dialog open={open} onOpenChange={setOpen} title="Export">…</Dialog>
<Input label="Name" required invalid={problem !== null} errorMessage={problem} />
<Checkbox indeterminate>Mixed</Checkbox>
<ComboBox label="Part" {...async} loading={async.loading} />
```

<!-- entry: rank=10 breaking api -->
