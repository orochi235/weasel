---
'@weasel-js/forge': patch
---

The story index reads CSF2 annotations assigned after a story, such as `Primary.storyName = 'Main'` and `Primary.parameters = { forge: { isolate: '…' } }`, which the running story already honored. The tree and test names now show the assigned name, and an assigned isolate reason isolates the story.
