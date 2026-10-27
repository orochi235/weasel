# CSS and theme traps

Things in theme tokens and stylesheets that pass every test and are still wrong.

**Only `[data-wzl-mode]` switches the theme — an attribute named anything else is inert.**
`tokens.css` keys its mode blocks off it, and `applyTheme` is what writes it. forge's `mode`
global goes through `applyTheme` onto the frame's `<html>`, so every story in the workshop,
bare `@weasel-js/ui` included, follows Auto/Light/Dark without a decorator of its own. A story
that sets `data-theme`, or wraps itself to restate the mode, is either doing nothing or
verifying one mode twice — Storybook's `theme` global was the original source of that, and both
it and the workarounds it needed are gone.

**A `var()` inside a custom property is substituted where that property is declared.** So
`--wzl-x: 0 1px 3px var(--wzl-shadow)` in `:root` bakes in the default mode's shadow and
inherits that frozen value into every other mode's block. In a real property it resolves per
element and is fine. `build-tokens.ts` now redeclares any token whose reference chain reaches a
mode semantic inside every mode block, so authoring one is safe — but hand-written CSS is not
covered, and jsdom resolves neither `var()` nor `color-mix()`, so only a browser can tell you.

**A consumer overriding a theme token at matching specificity loses silently.** `applyTheme`
emits one flat rule carrying the whole resolved token set on
`[data-wzl-theme='x'][data-wzl-mode='dark'][data-wzl-density='comfortable']` — (0,3,0). The
build-time emitter behind `tokens.css` is a different path that splits per axis and tops out at
(0,2,0), so grepping the generated file finds no such selector and makes this look untrue. A
consumer restated the type scale on `:root [data-wzl-theme][data-wzl-mode]` — also (0,3,0) — and
lost the tie on source order, since an adopted stylesheet comes after every author sheet. The app
fell back to the default density everywhere with no console warning: chrome text at 13px where
15px was intended, read with `getComputedStyle`. It looked like one panel being small rather than
a dead token block, because the app's own rem rules were unaffected. A consumer picks the axis
(`selection={{ density: 'roomy' }}`) instead of restating its numbers, and a kit default meant to
be overridden either sits in `:where()` or is read as a `var()` fallback, so there is no tie to
lose.

**A `:where()` override hook covers only the declarations inside it.** `Dialog` moved its
body's `padding` and `overflow` into `:where(.body)` so `bodyClassName` could turn them off, and
left `min-height: 0` in the plain rule beside it. That one declaration then beat the consumer
class on source order, and a dialog told to hold a settled height resized itself around whichever
pane was open — the two properties it had been given worked, which is what made the third look
like something else. Move the whole set a consumer must beat, not the ones that prompted the fix.

**`--wzl-fg-on-accent` is the text-on-accent token; `--wzl-accent-fg` is the accent used *as*
text** (it resolves to `--wzl-accent-strong`). Reach for the second to label a selected row in an
accent-filled rail and it paints the text in its own background color, invisible. The fallback in
`var(--wzl-accent-fg, #fff)` never fires either, because the token does exist — nothing warns, no
test sees it, and the row reads as an empty highlight bar in a screenshot.

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare `button` nested under
`.lk-root` is specificity (0,1,1) and outranks every component class. Don't unwrap them. The flip
side bites too: specificity cannot stop a default from filling in a property a component never
sets — its `height` crushed a 16px glyph to 2px and forced ToggleBar segments out of their track.
So the button default matches only a class-less or `lk-` button; widen that selector and every
weasel-ui button inside a lab inherits it again.
