# A front page for the demo site

**Status: designed 2026-10-10, not built.** Nothing below exists yet. Delete this file when the work merges.

For whoever implements it. It answers: what does a visitor see at the demo site's root URL, which
today has no page of its own and falls through to the first demo.

## What a visitor sees

One screen, centered, with no sidebar and no scrolling:

```
                    weasel
     A 2D scene-graph canvas engine for React.
              npm i @weasel-js/core

      Get started     API docs      Demos
      Components      WeaselDraw    Releases

                                    [theme toggle]
```

It is deliberately plain. Making it distinctive (a live canvas, motion) is later work.

| Link | Goes to |
|---|---|
| Get started | A new page in the existing sidebar layout; see below |
| API docs | `./api/` |
| Demos | The first demo, in the existing sidebar layout |
| Components | The forge workshop, `./docs/ui/forge/` |
| WeaselDraw | `./draw/` |
| Releases | The existing "What's new" page |

Every other page keeps the current sidebar-and-content layout and its current colors. The sidebar's
logo becomes a link back to the front page.

## Design

**Routing.** The site routes on the URL hash. An empty hash, or one naming nothing the site knows,
shows the front page; today both show the first demo. A known id renders the existing layout as it
does now. The front page does not write a hash into the URL.

**Components**, each in its own file under `apps/site/FrontPage/` with a CSS module beside it.
Nothing is added to `canvas-kit-demo.css`.

- `FrontPage`: the screen above.
- `Wordmark`: the "weasel" logotype. The sidebar header uses the same component, so the mark is
  defined once. The "w" is the green the gradient starts from, and "easel" carries the existing
  green-to-yellow-to-rose gradient (`.ckd-sidebar-rainbow`). Never a full-spectrum rainbow.
- `GetStarted`: see below.

**Theme toggle.** The palette is undecided, so the front page ships three and a control to switch
between them: a neutral charcoal, the project's maroon with lime accent (the colors in the repo's
`.hued` file), and a light paper. Charcoal is the default.

- Each is a theme defined with `defineTheme` from `@weasel-js/theme`, and the front page is wrapped
  in that package's `ThemeProvider`. The page's styles read `--wzl-*` tokens and name no colors of
  their own, so it is a small reference for theming with the kit.
- The control is `ToggleBar` from `@weasel-js/ui`, in a corner of the page.
- The choice is kept per browser in `localStorage`, read and written inside `try`/`catch`; when
  storage is unavailable the page shows charcoal.
- The theme applies to the front page only. When a palette is chosen for good, the toggle and the
  two losing themes are deleted.

**Get started.** A page with the id `__get_started`, shown in the existing layout and listed at the
top of the sidebar beside "What's new". Its text is the "Install" and "How it fits together"
sections of `packages/core/README.md`, so the README stays the one place that text is written. A
vite plugin modeled on `scripts/vite-changelogs.ts` slices those two sections out by heading and
converts them to HTML with `marked` (already a dependency) at build time, exposed as
`virtual:get-started`. The build fails if either heading is missing.

## Verifying the result

- A unit test for the hash reader: empty and unknown hashes give the front page; a demo id, the
  "What's new" id, and the "Get started" id give themselves.
- A unit test for the README slicer: both sections present in the output; a missing heading throws.
- A `*.browser.test.tsx` for the front page: all six links render with their destinations;
  switching the toggle changes the computed page background; `scrollTo(0, 5000)` leaves `scrollY`
  at 0.
- Screenshots of the front page in each theme, and of a demo page to confirm it is unchanged,
  taken headless and posted to the wall.
