---
'@weasel-js/core': patch
---

A window blur now cancels every pointer held on the canvas. A drag in flight
ends with reason `'cancel'` rather than waiting for a release that may never
arrive, and a press that had not yet become a drag is dropped without a click.
