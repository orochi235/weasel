---
'@weasel-js/svg': minor
---

`svgClipBinder` plays an imported SVG's SMIL on the scene nodes it was unpacked into.

It binds `ParseResult.clip`'s tracks to the nodes `svgNodesToKitDrafts` drafted from the same parse: an element's `opacity` fades every leaf under it, `fill`, `stroke`, their opacities, `stroke-width` and the dash attributes move a shape's paint, geometry attributes (`r`, `cx`, `width`, `points`, `d`, …) are lowered again each frame, and `<animateTransform>` moves the pose of every shape the element reaches. Drafts now carry `source`, the id of the element each came from, and a leaf an animated opacity reaches carries `fade`. A text or image under an animated transform stays still.

```ts
const parsed = parseSvg(text);
const drafts = svgNodesToKitDrafts(parsed, () => scene.mintId());
for (const spec of svgDraftSpecs(drafts, { layer, composition: scene.composition })) scene.add(spec);
animator.timeline(bindClip(parsed.clip!, svgClipBinder(scene, parsed, drafts)));
```

<!-- entry: rank=10 new api -->
