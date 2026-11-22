## parseInline drops plain relative links that its docstring promises to keep
- where: packages/ui/src/components/InlineMarkdown/parseInline.ts:35 (SAFE_HREF), docstring at :40
- scenario: `parseInline('[guide](guide.html)')` or `[next](docs/page.md)` → `SAFE_HREF` (`/^(https?:|mailto:|[/#.])/i`) only admits relative hrefs starting with `/`, `#` or `.`, so a bare relative path comes back as its label alone, though the docstring says only an href that is "not http(s), mailto, or relative" is dropped. Either the docstring should say "rooted or dot-relative", or the check should reject only a scheme (`/^[a-z][a-z0-9+.-]*:/i` not in the allowlist) so plain relative paths pass.
- evidence: read
- severity: low

## InlineMarkdown opens same-page `#fragment` links in a new tab
- where: packages/ui/src/components/InlineMarkdown/InlineMarkdown.tsx:45 (drawToken, 'link' case)
- scenario: `<InlineMarkdown text="see [below](#options)" />` → parseInline admits `#options` deliberately (SAFE_HREF includes `#`), but every anchor gets `target="_blank"`, so clicking an in-page anchor opens a fresh copy of the page in a new tab instead of scrolling to `#options`. The same applies to the `/` and `.` relative links SAFE_HREF admits. A fragment (at least) should render without `target="_blank"`.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/FloatingPanel/dragPlacement.ts
packages/ui/src/components/FloatingPanel/index.ts
packages/ui/src/components/FloatingPanel/useFloatingPlacement.ts
packages/ui/src/components/FontOptions/fontOptions.ts
packages/ui/src/components/FontOptions/index.ts
packages/ui/src/components/Foundations/Foundations.module.css
packages/ui/src/components/Foundations/Foundations.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.module.css
packages/ui/src/components/FpsMeter/FpsMeter.stories.tsx
packages/ui/src/components/FpsMeter/FpsMeter.tsx
packages/ui/src/components/FpsMeter/fpsAverage.ts
packages/ui/src/components/FpsMeter/index.ts
packages/ui/src/components/HistoryList/HistoryList.module.css
packages/ui/src/components/HistoryList/HistoryList.stories.tsx
packages/ui/src/components/HistoryList/HistoryList.tsx
packages/ui/src/components/HistoryList/index.ts
packages/ui/src/components/Icon/Icon.gallery.stories.module.css
packages/ui/src/components/Icon/Icon.gallery.stories.tsx
packages/ui/src/components/Icon/Icon.tsx
packages/ui/src/components/Icon/actionIcon.ts
packages/ui/src/components/Icon/iconFromData.ts
packages/ui/src/components/Icon/index.ts
packages/ui/src/components/Icon/layers.ts
packages/ui/src/components/Icon/placeholder.ts
packages/ui/src/components/Icon/resolveIcon.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.stories.tsx
packages/ui/src/components/InlineMarkdown/InlineMarkdown.tsx
packages/ui/src/components/InlineMarkdown/index.ts
packages/ui/src/components/InlineMarkdown/parseInline.ts
packages/ui/src/components/InlineRange/InlineRange.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.module.css
packages/ui/src/components/InlineRange/InlineRange.stories.tsx
packages/ui/src/components/InlineRange/InlineRange.tsx
packages/ui/src/components/InlineRange/index.ts
packages/ui/src/components/InlineRange/useRangeEdit.ts
packages/ui/src/components/Input/Input.module.css
packages/ui/src/components/Input/Input.stories.module.css
packages/ui/src/components/Input/Input.stories.tsx
packages/ui/src/components/Input/Input.tsx
packages/ui/src/components/Input/index.ts
packages/ui/src/components/ItemList/ItemList.module.css
packages/ui/src/components/ItemList/ItemList.stories.module.css
packages/ui/src/components/ItemList/ItemList.stories.tsx
packages/ui/src/components/ItemList/ItemList.tsx
packages/ui/src/components/ItemList/domItemList.tsx
packages/ui/src/components/ItemList/index.ts

<!-- done: 2 findings, files read: 46 -->
