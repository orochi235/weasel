---
"@weasel-js/labkit": patch
---

A trial config write of the value a path already holds, including `auto` written over a path already auto, does nothing: it records no undo step and runs no `onConfigChange`. A drag that ends back where it began, with the trial's state back as well, leaves no step either. Both used to leave an undo step that changed nothing, so the next Undo seemed to do nothing.
