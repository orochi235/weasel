---
'@weasel-js/ui': patch
---

A `MenuBar` title that underlines an access letter is named by its whole label. The title's flex layout had made the letter a block of its own, so assistive technology read "File" as "F ile" and `getByRole('menuitem', { name: 'File' })` found nothing.
