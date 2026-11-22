---
'@weasel-js/core': patch
---

An `animateOnSetPose` write passed straight through now ends the node's running glide, so the pose it wrote stands.

This holds over an adapter with no pose target, for a node under a gesture or one `shouldAnimate` refuses.

<!-- entry: fix -->
