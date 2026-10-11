---
'@weasel-js/labkit': patch
---

A lab whose storage cannot be read at open now recovers. `openLabStore` retries the read on the record cache's backoff, and when one lands it migrates the stored lab as it would have at open, a document from before records included, then merges it into whatever was built meanwhile: a stored trial or snapshot replaces one of the same id, the rest of what was built follows the stored ones and is written, and layout and undocked panels merge by trial with the stored entry winning. Before, such a lab stayed empty and unsaved for the session. A write storage rejects is also sent again on its own now, where it waited for the next change.
