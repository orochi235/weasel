---
"@weasel-js/icons": patch
---

A variant's load is out of flight before the registry announces it loaded or failed, so a subscriber that retries a failed variant from that notice starts a fresh load. It had been handed the failed load's own promise, and the variant stayed failed.
