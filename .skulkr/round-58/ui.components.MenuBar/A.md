I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 58: ui.components.MenuBar

## Pressing a disabled title while another title's menu is open does nothing, and that menu stays open
- where: packages/ui/src/components/MenuBar/MenuBar.tsx:69 (show), :92 (inside), :141 (onPress)
- scenario: File's menu is open, and the user presses Edit, whose `enableIf` fails. `inside` counts every title button as inside the menu, so `OpenPanels` doesn't treat the press as an outside press and doesn't close. `onPress` calls `show('edit', …)`, which hits `disabled.has(key)` and returns before it changes `opened`. File's menu stays open and File keeps `aria-expanded`, even though the user pressed a different title. Hovering onto a disabled title does the same (`onEnter` → `show` → early return). It should do one of two things: close the open menu on the press, or leave disabled titles out of `inside` so the press counts as outside.
- evidence: read
- severity: low

## Moving from an open menu onto a title whose menu has no rows sends focus out of the bar
- where: packages/ui/src/components/MenuBar/MenuBar.tsx:72-75 (show)
- scenario: File's menu is open with focus in it. The pointer moves onto View, whose rows are all hidden by `showIf`, so `resolve` returns `[]`.
  - `show` calls `setOpened(null)` directly instead of going through `close`/`focus.closed`, and with `source === 'pointer'` it focuses nothing.
  - The panel unmounts with focus inside it, so focus falls to `body`.
  - `useFocusBackOnClose` then calls `leave(null)`, which gives focus back to whatever had it before the bar.

  Crossing an empty title ends the whole menu-bar interaction. The keyboard path calls `el.focus()` and keeps focus on the title, so pointer and keyboard handle the same transition differently.
- evidence: read (traced, not run)
- severity: low

## On touch, tapping a second title while a menu is open can open that menu and close it at once
- where: packages/ui/src/components/MenuBar/MenuBarTitle.tsx:34-35; packages/ui/src/components/MenuBar/MenuBar.tsx:141-142
- scenario: A menu is open and the user taps another title. Touch fires pointerenter just before pointerdown. `onEnter` sees `opened` holding a different key and calls `show(t.key, …)`. If React has re-rendered before pointerdown arrives, `onPress` sees `opened?.key === t.key` and calls `close()`, so the tap's menu opens and closes immediately. That depends on React flushing the pointerenter update (a continuous-priority event) before the pointerdown, so this is inferred, not observed. No handler checks `pointerType`, and no MenuBar test covers touch.
- evidence: inference (read, not run)
- severity: low

## The story's blurb puts the zoom readout between Edit and View, but MenuBar draws it after View
- where: packages/ui/src/components/MenuBar/MenuBar.stories.tsx:54-56 (FileEditView doc comment)
- scenario: The blurb says "with a readout between Edit and View". `MenuBar` renders every `as: 'menu'` title inside the menubar div and every `other` run after it (MenuBar.tsx:129-150; its prop doc also says "drawn after the titles"). So the readout shows up after View, and the story misdescribes the layout it demonstrates.
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

<!-- done: 4 findings, files read: 10 -->