Read-only typed number rounded to its step (A+B): fixed 6d7c3d800b

Read-only boolean with no value reads "—" while the editable field reads it as off (A+B): fixed d852e144fe. This was my call, recorded in `docs/unruled.md`. A missing value now means "not set" everywhere: the editable checkbox and switch are dimmed with the "Not set" cue, and the read-only field keeps the dash from ac24d7b685. The prop's doc no longer says "Absent reads as off".

Holding Enter or Space repeats the auto toggle (A): fixed ca60d1f76c. The same fix covers `ResetControl` through one shared key handler, `buttonKeys`.

Boolean `toggle` with a non-string row label draws an empty segment (A): fixed 469dd037f6

A wrapping validation message marks an inline row multiline (B): fixed f8a10a055a

`readout={false}` or `hint={false}` draws an empty box (B): fixed 9bf64d8099. The auto value's `autoValue != null` test had the same mistake and is fixed in the same commit.

Extra, a typed number preference with an infinity word was rounded to its step, the same fallback in `Prefs/prefField.tsx` (sweep): fixed dfae0000ee

Checks:
- touched test files, one at a time: `prefField.places` pass, `PropertyField.names` pass, `PropertyField` pass, `PropertyReadout` pass, `PropertyRow.auto` pass, `PropertyRow.multiline` pass, `PropertyRow.render` pass, `RowScope` pass. Also run, all pass: `PropertyField.noValue`, `PropertyField.kinds`, `PropertyField.disabled`, `PrefsForm.absent`, `PrefsForm.kinds`, `PropertyRow.autoDisabled`, `PropertyRow.help`, `PropertyRow.error`.
- `npm run check:changesets`: pass
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w packages/ui`: fail, "Missing script: "lint"". `@weasel-js/ui` has no lint script; the root `npm run lint` inside the gate passed.
- browser tests: none touched, none unrun.

tally: 6 of 6 fixed, 1 extra fixed