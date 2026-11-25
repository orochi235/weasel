# Audit round 80 — forge.vite.part1

## The props table and the dependency graph pick different components for the same story file
- where: packages/forge/src/vite/componentOf.ts:27 (componentOf), against packages/forge/src/vite/bindings.ts:84 (createBindings → componentOf)
- scenario: a story file whose meta sets `component: Wrapper`, where `Wrapper` is declared in the story file itself and no import matches the title's last segment. `componentOf.ts` keeps `symbol` (the local wrapper) and returns the wrapper's props, so the API table and controls describe the wrapper. The graph's `componentOf` only accepts an *import* named by `componentName` or the title, so it answers null for the same file. The comment on line 26 says the local wrapper "is the story's, not the component's, as the dependency graph reads it", but the code still falls back to it. The same split happens with `component: Tabs.Panel`, a member of an imported namespace or object: `assigned` resolves it and the API reads it, but `indexFile` records no `componentName` because the node is not an Identifier, so the graph falls back to the title's import or to null. One question, which binding is this file's component, gets two answers.
- evidence: read
- severity: medium

## Top-level `let`/`var` bindings are read as if they were constants
- where: packages/forge/src/vite/ast.ts:33 (bindingsOf), used by stringOf/valueOf/objectOf in packages/forge/src/vite/indexFile.ts:156
- scenario: `let title = 'A'; title = 'B'; export default { title };` makes `bindingsOf` record the `let` initializer, so `stringOf` gives the title 'A' while the module evaluates to 'B'. The index, the story ids and the tree then disagree with what the loaded module says. The doc comments on calleeOf/valueOf/stringOf promise to follow "top-level `const`s", but `bindingsOf` does not check `decl.kind`, so `let` and `var` locals that are reassigned later are followed too.
- evidence: read
- severity: low

## Capture size check tests the unrounded box, but the viewport is rounded up
- where: packages/forge/src/vite/capture/payload.ts:72 (parsePayload), against packages/forge/src/vite/capture/browser.ts:194 (render)
- scenario: any width w with w·dpr ≤ 16384 < ceil(w)·dpr passes the check. For example, w = 5461.3 at dpr 3 gives 16383.9. `render` then sets the viewport to `Math.ceil(w)` = 5462, which is 16386 device pixels, past `MAX_DEVICE_PX`, the Chromium texture limit the check exists to enforce. The check should compare `Math.ceil(box.width) * dpr`.
- evidence: read
- severity: low

## Origin check rejects pages served on a default port
- where: packages/forge/src/vite/capture/endpoint.ts:60 (ownOrigin)
- scenario: a dev server on port 80 (http) or 443 (https), opened at `http://127.0.0.1/`. The browser sends `Origin: http://127.0.0.1`. `socketOrigin` builds `http://127.0.0.1:80`, which is not equal to `new URL(origin).origin`, which drops the default port. The loopback branch compares `url.port` (`''`) with `'80'` and fails. Unless vite printed that exact host, the capture POST gets 403 from the server's own page. Both sides should be compared as normalized URL origins (`new URL(socketOrigin(...)).origin`), and the port compared as `url.port || default`.
- evidence: read
- severity: low

## freeNames skips decorators on methods
- where: packages/forge/src/vite/freeNames.ts:104 (freeNames → walk, isFunction branch)
- scenario: `class Panel { @bound handle() {} }` or `@track('x') render() {}`. For ClassMethod and ClassPrivateMethod, the function branch walks only the computed key, the params and the body, never `n.decorators`. Class decorators and property decorators are walked, because those go through `children`. So a component reached only through a method decorator, or a helper used only there, is missing from the component's refs, and the graph's `uses` leaves it out.
- evidence: read
- severity: low

## folderTitleReport passes silently when paths use backslashes
- where: packages/forge/src/vite/folderTitles.ts:59 (folderTitleReport), packages/forge/src/vite/folderTitles.ts:24 (folderTitles)
- scenario: on Windows, `relative(root, entry.file)` returns `packages\ui\src\...`. `folderTitles` checks `rel.startsWith('packages/ui/src/')` and splits on `/`, so every file reads as not covered and the check reports `ok: true` without checking anything. The path should be converted to posix form before the test, as `autoTitle` does with `posix()`.
- evidence: read
- severity: low

## Files read
packages/forge/src/vite/apiTable.ts
packages/forge/src/vite/ast.ts
packages/forge/src/vite/autoTitle.ts
packages/forge/src/vite/bindings.ts
packages/forge/src/vite/build.ts
packages/forge/src/vite/capture/browser.ts
packages/forge/src/vite/capture/cache.ts
packages/forge/src/vite/capture/endpoint.ts
packages/forge/src/vite/capture/entries.ts
packages/forge/src/vite/capture/payload.ts
packages/forge/src/vite/componentGraph.ts
packages/forge/src/vite/componentOf.ts
packages/forge/src/vite/componentReach.ts
packages/forge/src/vite/depsFeed.ts
packages/forge/src/vite/entries.ts
packages/forge/src/vite/folderTitles.ts
packages/forge/src/vite/foreignStories.ts
packages/forge/src/vite/forgeTest.ts
packages/forge/src/vite/freeNames.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts

<!-- done: 6 findings, files read: 26 -->
