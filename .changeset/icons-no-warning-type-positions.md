---
'@weasel-js/icons-plugin': patch
---

The "used other than as a direct call" warning no longer fires for `icon` in `as`, `satisfies`, or `implements` types, an enum member, an index signature, or a parameter of an overload, `declare function` or abstract method.

<!-- entry: fix -->
