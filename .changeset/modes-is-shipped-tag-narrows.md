---
'@weasel-js/modes': minor
---

`isShippedTag(tag)` narrows `tag` to one of the shipped tags, and leaves a string it rejects typed as a string.

`ShippedTag` names that union.

```ts
if (isShippedTag(tag)) SHIPPED_TAGS.indexOf(tag);
else warn(`unknown tag ${tag}`);
```

<!-- entry: fix api -->
