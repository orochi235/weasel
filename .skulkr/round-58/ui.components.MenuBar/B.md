I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is below.

## A touch tap on a second title while a menu is open closes every menu instead of switching to that title
- where: packages/ui/src/components/MenuBar/MenuBarTitle.tsx:34-35 (onPointerDown / onPointerEnter), packages/ui/src/components/MenuBar/MenuBar.tsx:141-142 (onPress / onEnter)
- scenario: File's menu is open and the reader taps Edit on a touchscreen. A touch pointer can't hover, so the browser fires `pointerenter` right before `pointerdown` on Edit.
  1. `onEnter` sees `opened.key === 'file'` and calls `show('edit', 'pointer', …)`.
  2. React applies that update before the next event, so when `pointerdown` arrives, `onPress` sees `opened.key === 'edit'` and calls `close()`.

  One tap opens Edit and then closes it, and no menu is left open. The reader has to tap again. It should switch to Edit. A mouse doesn't hit this, because its `pointerenter` fires on an earlier move, before the press. The toggle in `onPress` can't tell a menu opened by this same touch's `pointerenter` from one that was already open.
- evidence: read (the event order comes from the Pointer Events spec for devices that can't hover; not run in a browser)
- severity: medium

## The story's description says the readout sits between Edit and View, but MenuBar draws every non-menu run after all the titles
- where: packages/ui/src/components/MenuBar/MenuBar.stories.tsx:55-57 (FileEditView doc comment), :32 (zoom's description)
- scenario: `SCHEMA` declares `zoom` between `edit` and `view`. `MenuBar` draws the titles inside the `role="menubar"` div and every `kind: 'other'` run after that div (MenuBar.tsx:130-150). Its own props doc says so ("drawn after the titles"), and `MenuBar.test.tsx:182` checks it. So the story shows File, Edit, View, then Zoom. The story's blurb ("with a readout between Edit and View") and the leaf's description ("A leaf between menus") describe a layout the component never draws.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/MenuBar/MenuBar.module.css
packages/ui/src/components/MenuBar/MenuBar.stories.module.css
packages/ui/src/components/MenuBar/MenuBar.stories.tsx
packages/ui/src/components/MenuBar/MenuBar.tsx
packages/ui/src/components/MenuBar/MenuBarTitle.tsx
packages/ui/src/components/MenuBar/index.ts
packages/ui/src/components/MenuBar/menuBarHandle.ts
packages/ui/src/components/MenuBar/menuBarTitles.ts
packages/ui/src/components/MenuBar/useMenuBarFocus.ts
packages/ui/src/components/MenuBar/useMenuBarKeys.tsx

<!-- done: 2 findings, files read: 10 -->