---
'@weasel-js/labkit': patch
---

**Breaking for installs:** `@weasel-js/theme` moves from labkit's dependencies
to its `peerDependencies`, at an exact version, alongside `@weasel-js/core`.
An install that cannot satisfy it now fails with `ERESOLVE` rather than nesting
a second copy.

labkit's `tsup` and `.d.ts` builds stop inlining theme, for the reason they
already stop at core: a second copy has an identity its callers compare
against. Theme owns a React context and `applyTheme`'s handle on the
`wzl-themes` stylesheet, so labkit's bundled copy gave `<LabShell>`'s
`useThemeOptional()` a context the app's own `ThemeProvider` had never written
to — it read `null` and wrapped a second provider over the app's theme. Where
`adoptedStyleSheets` is missing, both copies also appended their own
`<style id="wzl-themes">`. Inside the repo aliases resolved both to one source,
so this only ever appeared against the packed packages.

`test:smoke:consumer` gains a peer-externalization audit that holds it: for
every package, a `@weasel-js` peer it imports at runtime must appear as an
external specifier in its own `dist` JS.
