---
'@weasel-js/ui': major
---

`Powerline` takes its segments as child `Badge`s, and its `segments` prop is gone.

Each badge's new `endCap` prop shapes its right edge, and the next badge in the row takes it as its left edge. The row's `variant`, `size`, `depth`, and `startCap` still apply to every segment, a badge's own `variant` or `size` winning. A badge given a `base` of its own keeps it. A custom segment calls `usePowerlineSegment(endCap)` for its edges and the row's defaults. `PowerlineSegment` is removed.

```tsx
// before
<Powerline variant="solid" segments={[{ text: 'main', emphasis: 'high', endCap: 'chevron' }, { text: '~/proj' }]} />
// after
<Powerline variant="solid">
  <Badge emphasis="high" endCap="chevron">main</Badge>
  <Badge>~/proj</Badge>
</Powerline>
```

<!-- entry: rank=5 breaking api -->
