---
'@weasel-js/diagram': major
---

`EffectEditor`'s cluster pick and ref methods are named for clusters, with the same on-screen labels.

`selectedCluster`, `onSelectCluster`, and the ref's `cluster`, `dissolveCluster` and `renameCluster` were `selectedGroup`, `onSelectGroup`, `group`, `ungroup` and `renameGroup`. The edits still report themselves as 'Group', 'Ungroup' and 'Rename group'.

```tsx
// before
<EffectEditor ref={editor} selectedGroup={picked} onSelectGroup={setPicked} … />
editor.current?.group(ids);
// after
<EffectEditor ref={editor} selectedCluster={picked} onSelectCluster={setPicked} … />
editor.current?.cluster(ids);
```

<!-- entry: breaking api -->
