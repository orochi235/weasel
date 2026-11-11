---
"@weasel-js/core": patch
---

Grouping members with different parents puts the new group in their lowest common ancestor, in the place of the frontmost member's branch. This holds for Group and the boolean group, and the group stays inside every container its members shared.

<!-- entry: rank=10 behavior fix -->
