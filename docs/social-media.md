# Facebook and Instagram

The homepage includes a responsive social block above its footer in Dutch, French and English. Facebook sharing and device sharing (with clipboard fallback) work independently of profile configuration. No Meta scripts, cookies, access tokens or embedded feeds are loaded.

To activate the follow buttons, enter the owner's confirmed HTTPS Facebook page and Instagram profile URLs in `lib/social-profiles.json`, then deploy. Empty or invalid URLs stay hidden. Do not guess usernames. Profile links open in a new tab.

This integration links to the profiles; it does not link Meta accounts to each other or automatically publish posts. Those operations require a separate Meta account setup and authorization.

Verification: check all three languages and a narrow mobile screen; check each follow button after the actual URLs are supplied; check Facebook sharing and device sharing/copy, including dismissing the device share menu.
