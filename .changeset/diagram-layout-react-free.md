---
"@weasel-js/diagram": patch
---

`@weasel-js/diagram/layout` no longer loads React. Its body builder imported
`cssFamilyName` from the `@weasel-js/core` barrel, which pulled the whole kit
into a subpath meant for a server with no DOM; it now imports from
`@weasel-js/font`, which `@weasel-js/diagram` declares as a peer.
