# Cote de Duras — native iPhone app

This is the native SwiftUI visitor app, not a WebView wrapper. It uses the same public event and directory records as the browser prototype. The existing website's administration and payment routes are not included in the dedicated visitor service (`native-api`).

## Build

Open `CoteDeDuras.xcodeproj` in current Xcode on a Mac. Select the `CoteDeDuras` scheme for simulator tests. The repository's `iOS visitor app` workflow builds and tests on a standard GitHub-hosted macOS runner; this repository is public. It uploads no artifacts or caches and does not use a paid larger runner.

`xcodebuild test -project ios/CoteDeDuras.xcodeproj -scheme CoteDeDuras -destination 'platform=iOS Simulator,id=SIMULATOR_UUID' CODE_SIGNING_ALLOWED=NO`

UI tests launch with `--ui-testing`. That argument enables isolated, clearly marked fixtures only in Debug builds; it is disabled in Beta/Release. Tests do not contact a live database, charge payments, send messages, or save events to a real person's calendar.

## Configuration and signing

- Debug and the `CoteDeDuras-TestFlight` scheme's Beta archive use the designated public test API. Verify the final project URL before archiving.
- The App Store Release API URL is intentionally empty. Do not replace it until the production dataset, public sources, privacy declarations and owner contact details have been reviewed.
- `com.cotededuras.app` is a proposed bundle identifier, not a registered App ID. Set the user's Apple Team and confirm identifier availability in Xcode/App Store Connect before signing.
- No signing certificate, provisioning profile, Apple account credential or Supabase server key is committed.
- Xcode is free. Apple Developer Program membership is needed for distributing through TestFlight and the App Store. Enrollment and contractual/payment steps must be completed by the user.

## Native capabilities

Agenda/category/place/date/distance/free filters; highlighted ads first; directory with real source photos and attribution; native sharing, calling, email and Apple Maps; local favourites with compatible JSON backups and reviewed merging; native EventKitUI calendar editing, with the visitor confirming the event. The app does not request full calendar read access, GPS, contacts or tracking.

Previously loaded public JSON can be used when a request fails. The app labels cached data; dates still exclude expired events. Photos are not guaranteed to be available offline. Favourites remain local and are never sent to the API.

`PrivacyInfo.xcprivacy` declares app-container file timestamp access (C617.1), used to label the age of cached public data. App Store privacy answers must also account for the hosting provider's technical request logs and external photo hosts; the manifest alone is not the submission questionnaire.

## Release gates

A simulator build is not an installable iPhone release and not App Store approval. Before public release: successful simulator build/tests; real iPhone testing including native calendar cancel/save, sharing, links, photo loading and backup restore; correct public production API and dataset (no test adverts); owner-approved privacy/contact/age/category declarations; signed Beta archive and TestFlight testing; screenshots from the actual app; final App Store review.
