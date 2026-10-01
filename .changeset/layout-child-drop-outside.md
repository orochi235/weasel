---
"@weasel-js/core": patch
---

A child dragged out of its layout container and released where no container
takes it now leaves that container, landing under the plain container beneath
the drop or at the top level, at the position it was dropped. It used to stay
the container's child and draw clipped to it, out of sight. A container whose
`releaseDrop` returns ops still decides the release, and a drop back inside the
container keeps the child where it is.
