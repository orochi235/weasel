---
'@weasel-js/routing': patch
---

On a canvas with several views, a file dropped on one view while the pointer moved to another before the items finished loading ran on the first view's dispatcher with the second view's deps and rule context. The drop now keeps the view it landed in for both.
