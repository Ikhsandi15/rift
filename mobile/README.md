# Riftbound Mobile

Flutter + Dart client foundation for Riftbound. The Node API remains authoritative for accounts, Guardian progress, physical card claims, encounters, and rewards.

## Current mobile slice

- Flutter stable Android/iOS scaffold.
- Dio API client with secure access/refresh token storage and refresh rotation.
- QR scanner that extracts `/card/<token>` links.
- App links stream for incoming card URLs.
- Login/register, Guardian roster, card claim selection, Guardian profile, and Camp Khar world prototype screen.
- Flame dependency is installed for the next renderer milestone; the current world screen is a safe procedural Flutter painter prototype, not final gameplay.

## Run

```bash
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=RIFT_API_BASE_URL=https://rift.pascadigital.my.id
```

Do not put the backend `ADMIN_KEY` in this app. The app only receives short-lived access tokens and stores refresh tokens using platform secure storage.

## Deep links

Android manifest and iOS Associated Domains are configured for:

```text
https://rift.pascadigital.my.id/card/<token>
```

Before App Links/Universal Links work in a release build, publish and replace placeholders in:

- Backend `public/.well-known/assetlinks.json` with the Android release SHA-256 signing fingerprint.
- Backend `public/.well-known/apple-app-site-association` with the Apple Developer Team ID and final bundle ID.

The domain must serve these files over HTTPS without redirects. QR remains the fallback when app-link association is not active.

## NFC

The app declares Android/iOS camera and NFC permissions and includes `nfc_manager` for the planned NDEF URL reader. The currently verified scan flow is QR; NFC behavior must be tested on a physical NFC-capable phone and a real NDEF URL tag. Standard tags are bearer URLs and are cloneable.

## API contract

The mobile client uses:

- `POST /api/auth/mobile/register`
- `POST /api/auth/mobile/login`
- `POST /api/auth/mobile/refresh`
- `POST /api/auth/mobile/logout`
- `GET /api/me`
- `GET /api/content`
- `GET /api/card/state?token=...`
- `POST /api/cards/claim`
- `POST /api/avatars`

Refresh tokens rotate on every refresh. If a refresh token is replayed, the app clears local credentials and requires login again.
