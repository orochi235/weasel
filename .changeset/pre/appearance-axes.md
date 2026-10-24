---
"@weasel-js/theme": patch
"@weasel-js/ui": minor
"@weasel-js/labkit": patch
"@weasel-js/hud": patch
"@weasel-js/forge": patch
"@weasel-js/devtools": patch
---

**Breaking.** Four props now decide how a component looks, and each is a hint the component draws from as it sees fit: `stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact color). They replace a prop that meant two things and four spellings of severity. Color resolves as tint, then grade, then stance; emphasis sets how loudly it shows. Stance and emphasis pass to everything inside a surface; grade and tint do not, so a `danger` dialog's Cancel button stays plain.

| Was | Now |
|---|---|
| `status="accent"` / `"muted"` / `"neutral"` | `emphasis="high"` / `"low"` / nothing |
| `status="success"`, `"warn"`, `"danger"`, `"info"` | `grade="…"` |
| Badge `status="custom"` with `--badge-edge` | `tint={…}` |
| `tone={…}` (palette index or color), KeyDiagram's per-key `tone` | `tint={…}` |
| `stance="scope"` | `stance="clarify"` |
| `stance="danger"` / `"notice"` / `"important"` | `grade="danger"` / `grade="warn"` / `emphasis="high"` |
| Button `variant="primary"` / `"secondary"` | `stance="confirm"` / the default `variant="solid"` |
| Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
| labkit Toolbar `variant="danger"` | `grade="danger"` |

New stances are `confirm` and `cancel`. `useStance`, `StanceProps` and the `@weasel-js/ui/stance` subpath are gone; use `useAppearance`, `AppearanceProps` and `@weasel-js/ui/appearance`. `BadgeStatus`, `CodeStatus`, `ButtonStatus`, `DetailRowStatus` and `ToastTone` are deleted; `Grade`, `Emphasis` and `Stance` are exported in their place, and `DetailRow`, labkit `Readout` and Toast take `grade`. `BADGE_STATUS_ICONS` is now `GRADE_ICONS` and `EMPHASIS_ICONS`, exported from `@weasel-js/ui` and `@weasel-js/ui/appearance`, and the status glyphs are `gradeSuccess`, `emphasisHigh` and `emphasisLow`.

In `@weasel-js/theme`: `GRADES`, `GRADE_TOKENS`, `EMPHASES`, `EMPHASIS_FG`, `EMPHASIS_SLOTS` and `GRADE_SLOTS` join `STANCES`. `TONE_REF` is `TINT_REF` (`{ ref: 'tint' }`), the theme's tone list is its tint list (`ThemeProvider tints`, `useTints`, a theme's `"tints"`), and hud's `tones` option is `tints`. Stance tokens are renamed: `--wzl-stance-scope-*` → `--wzl-stance-clarify-*`, `--wzl-stance-<s>-tone(-mix)` → `-tint(-mix)`, `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`, `--wzl-button-primary-*` → `--wzl-button-confirm-*`; the danger, notice and important stance tokens are removed. A new `--wzl-info` token colors the info grade, so info badges and toasts take it, where info toasts used the accent before. Badge's `warn` now uses `--wzl-warning` rather than its own amber.

<!-- bump-approved: minor: maintainer — 1.13.0-rc release requested 2026-10-24 -->
