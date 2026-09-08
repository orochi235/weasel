---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Overlays portal into the nearest themed ancestor instead of `document.body`.

Every overlay this package portals — `Select`'s and `ComboBox`'s popovers,
`Dialog`, `Callout`, `Tooltip` — used to mount on `document.body`. That is
outside the element `applyTheme` / `<ThemeProvider>` stamps, so every `--wzl-*`
the overlay read resolved to the empty string and the panel fell back to browser
defaults: a light box with unreadable text in a dark app.

Each of them now mounts inside the nearest ancestor of its own position
carrying `data-wzl-theme` / `data-wzl-mode`, so it resolves the same tokens as
the control it belongs to. **This is a behavior change**: an overlay's DOM
position moves from the body into the app's tree. Anything reading the document
for overlay content by walking down from `document.body` will find it one place
deeper; anything using the `data-weasel-overlay` marker is unaffected.

Two ways to override it. `portalContainer` on any of the five components names
an element for that overlay alone, and `null` sends it back to
`document.body`. `<OverlayPortalProvider container={…}>` sets it for a whole
subtree. A styling root below the themed element can claim the overlays instead
by carrying `data-wzl-portal-host` — which is how labkit's `.lk-root`, whose
element defaults the themed wrapper above it does not have, now gets them. The
per-call-site container the labkit export panel was passing is gone.
