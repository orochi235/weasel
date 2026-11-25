fixed 940a2b58c1 — ComboBox reports Escape as an option commit when `selectedKey` and `inputValue` are both controlled (A)

fixed 9afedc0671 — a stacked ContainedModal loses its inert background when the modal under it closes first (A)

fixed 95ec94d94e — `DetailList layout="block" values="figures"` draws two columns (A+B; B's copy is a duplicate of this)

fixed ff5bfafd5a — `.table th/td` outranks DataGrid's `.empty` and its disclosure-column rules (A)

fixed 1cb1066513 — Dialog's contained path drops most `ModalOverlay` props (A+B; B's copy is a duplicate). It now forwards DOM props, `style`, `isEntering` and `isExiting`, and warns that it ignores `onEnter`, `onExit`, `UNSTABLE_deferUntilEntered` and `render`. That warning is a strict call, recorded in `docs/unruled.md`.

fixed 9d78c8c305 — Dialog's Basic story says a click outside closes it (A+B; B's copy is a duplicate)

fixed e8a4444a58 — ComboBox fires no `onCommit` when the already-selected option is picked again (A+B; B's copy is a duplicate). A's click case is not a defect: React Aria already reports a click on the selected option. Enter was the real gap.

fixed 80ce9a0330 — CycleButton throws on an empty `options` (A+B; B's copy is a duplicate). It now renders disabled, named by its `aria-label`. That is a strict call, recorded in `docs/unruled.md`.

fixed 2b30e63d5c — the command palette shows "No matching actions." while it fades out (B)

fixed 2121b68731 — content added to a contained modal's root after it opens stays interactive (B). Overlays (`data-weasel-overlay`) are left alone, so a popover or a stacked dialog stays usable.

fixed 62c13cf4e7 — DataGrid sorts text by UTF-16 code unit, and a column mixing numbers and text sorts inconsistently (B)

No extra defects fixed. One note, unverified and outside this area: labkit's lightbox `inertOutside` (`packages/labkit/src/lightbox/modal.ts`) uses the same skip-what-is-already-inert pattern, so stacked lightboxes may lose their inert background the same way.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: ComboBox.test.tsx pass (26), ComboBox.held.test.tsx pass (2), Dialog.contained.test.tsx pass (11), Dialog.test.tsx pass (7), CycleButton.test.tsx pass (11), usePaletteItems.test.tsx pass (1), CommandPalette.test.tsx pass (19), rowSort.test.ts pass (2), DataGrid.test.tsx pass (25), DetailList.test.tsx pass (24)
- Unrun (browser): DetailList.browser.test.tsx and DataGrid.browser.test.tsx, which each gained a layout test. Each CSS fix also has a jsdom test that reads the CSS text; checked by grep, the old stylesheets would fail both.
- `npm run checks:gate`: "checks:gate: all 32 passed". This run came before the last test-only fixups. After them, `npm run typecheck` passed again, and eslint passed on the changed DetailList and DataGrid directories.
- `npm run check:changesets`: "OK — 3097 changeset(s)."
- `npm run lint -w @weasel-js/ui`: not available, because `@weasel-js/ui` has no `lint` script. `npx eslint` over the six changed component directories passed (exit 0).
- `npm run check:size`: pass. The tree is clean.

tally: 16 of 16 fixed, 0 extra fixed