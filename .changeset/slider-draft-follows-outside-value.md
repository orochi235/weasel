---
'@weasel-js/ui': patch
---

A slider taking settled values only (a `PrefsForm` slider) could go on showing a drag's last position after the value changed from outside: a drag that ends where it began fires no `change`, so the position held during the drag was never let go. The held position now applies only to the value it was dragged from.
