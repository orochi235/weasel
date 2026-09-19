---
'@weasel-js/forge': patch
---

A CSF arg that is an object or array holding a function, a React element or a class
instance now gets an object control instead of none. The control edits the fields
that can cross to the frame; the frame puts the rest back from the story's own arg
before rendering, so JobProgress's `job`, Lab's `instruments` and Powerline's
`segments` are editable in forge the way they are in Storybook. Additive.
