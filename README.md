# Riftbound — Card Quest public-beta foundation

Riftbound is a browser-based 2D physical-avatar RPG beta. Each card has exactly one random QR/NFC URL. Before first registration it opens the registration flow and acts as the one bearer key to bind an account/avatar; after registration, that same URL shows the avatar only to its owner session. The URL is transferable only through an authenticated ownership transfer.

## Current capabilities

- Node.js HTTP server with SQLite persistence, WAL, foreign keys, and unique constraints.
- Local account registration/login with scrypt password hashes, hashed random session tokens, HttpOnly/SameSite cookies, and production Secure cookie setting. Local `.env` values load through the launcher; production secret injection still belongs in the hosting platform.
- Six original roles with different stats, archetypes, passives, skills, and lore: Vanguard, Tideweaver, Mosswarden, Rift Arcanist, Gearling, and Wisp Scout.
- Avatar creation, public profile card, progression, inventory seed, event chronicle, basic train/camp systems.
- Phaser 3 scene with keyboard movement, telegraphed enemy attack, attack/role skill/dodge feedback.
- Server-side encounter state and rewards; the browser submits action intent only.
- Admin-only card batch issuance; each card has one high-entropy bearer URL used for both initial registration and the eventual avatar page.
- QR fallback and print-friendly physical card. NFC writes the exact same URL; there is no second activation code.
- Security headers, CSP, body limits, Origin validation for mutations, rate limits, canonical `PUBLIC_BASE_URL`, and environment configuration.

## Run locally

Requirements: Node.js 20+ (tested with Node 24) and npm.

```bash
cd card-quest
npm install
npm run check
npm start
```

Open [http://localhost:3000](http://localhost:3000), register, awaken a guardian, then enter a Rift encounter. No demo account or unclaimed demo card is seeded.

The runtime database is created at `data/card-quest.sqlite` and is ignored by Git. To clear all local accounts/cards/test data, stop the app and run:

```bash
npm run reset
```

## Issue physical card inventory

Card issuance is disabled unless a private server-only `ADMIN_KEY` is set. Copy `.env.example` to your local environment/configuration; do not commit the populated secret. For a local test, set environment variables before startup:

Local production-like config is stored in the ignored `.env` file. For the real host, copy the non-secret values from `.env.example` into its environment/secret manager and generate a separate 48+ character `ADMIN_KEY` there. Never upload or commit the local `.env` file. The production target is `https://rift.pascadigital.my.id`; the existing root website at `pascadigital.my.id` must remain untouched.

### Caddy deployment outline

1. Point the `rift` DNS record at the server that will run Caddy. Keep the existing root-domain DNS/site unchanged.
2. Configure the Node app with `NODE_ENV=production`, `PUBLIC_BASE_URL=https://rift.pascadigital.my.id`, `PORT=3000`, a persistent `DB_PATH`, and a secret-manager `ADMIN_KEY`.
3. Run the app on loopback/private networking only (for example, `127.0.0.1:3000`) under a process manager/container and persist `data/card-quest.sqlite` plus SQLite WAL files across restarts.
4. Adapt [Caddyfile.example](./Caddyfile.example) to the actual service address. Allow inbound 80/443 and outbound certificate traffic; Caddy will obtain/renew TLS automatically once DNS resolves correctly.
5. Validate Caddy config, start/reload Caddy, then verify `https://game.pascadigital.my.id/api/health`, registration, and a test card on the deployed host. Configure off-host encrypted backups before issuing real cards.

This repository does not configure DNS, install Caddy, open firewall ports, provision a host, or apply the Caddyfile to a live server.

To run locally in development, use a separate local-only `.env` with `NODE_ENV=development` and `PUBLIC_BASE_URL=http://localhost:3000`; do not reuse production card URLs or admin secrets locally.

Then open `/admin.html`, provide the key, and generate up to 50 cards per batch. The issuance tool returns a random high-entropy URL for each card and can print those URLs as QR codes. The QR/NFC URL is the bearer registration key before first claim; ship/hand out cards securely. There is no separate activation secret.

For development API use:

```http
POST /api/admin/cards/issue
x-admin-key: <ADMIN_KEY>
Content-Type: application/json

{"count": 10}
```

The response includes one URL per card. The URL is the only card credential: opening an unregistered URL leads into login/register; after authentication, the player picks an avatar and claims it. The claim is atomic and first-come-first-served. Once claimed, another account cannot use that URL to take over the card; it only gets a login-required/registered-card page. The owner sees their avatar at that same URL.

## QR and NFC

- Single QR/NFC URL: `https://your-domain.example/card/<high-entropy-token>`.
- Before registration, possession of this URL allows the first authenticated account to bind it to one avatar. First registration wins; this is intentionally a bearer-card design.
- After registration, only the owning account session sees the avatar at that URL; other visitors are prompted to log into the owner account.
- Standard NTAG cards/QRs are clonable. Whoever copies an unclaimed URL can race to register it, so distribute cards securely. Do not treat NFC UID as anti-clone proof.
- To test QR from a phone on the same Wi-Fi, use the computer's LAN IP and set `PUBLIC_BASE_URL` to that origin. `localhost` on the phone refers to the phone.
- Production is configured for `https://rift.pascadigital.my.id`; actual deployment still requires DNS for the `rift` subdomain to point to the host, TLS certificate/HTTPS redirect, reverse-proxy forwarding to the Node process, persistent storage for `data/card-quest.sqlite`, server-side `ADMIN_KEY`, backups, and a privacy policy.

## RPG rules (early beta balance)

- XP next-level curve is `70 + 35 × level + floor(2.5 × level²)`.
- Each role has distinct base HP/stamina/ATK/DEF plus an active skill and passive. Skills currently affect combat through differentiated server-calculated damage/healing/control behavior; further playtests should tune role specifics.
- Main activity: explore the Rift, defeat an encounter, earn XP/gold, level up, and build the avatar's chronicle.
- Encounter starts are stored server-side. Attack, role-skill, and dodge actions are resolved server-side; victory grants authored XP/gold rewards.
- A camp recovery restores 35% max HP and 2 stamina, with a 30-minute cooldown (one process currently applies rate limits; persistent cooldown state is in SQLite).
- Gold is closed-loop virtual currency only: no purchase, cash-out, marketplace, or real-money value.
- Content seed: Riftling, Scrap Hound, Hollow Knight, Bell Warden boss; onboarding quests and original lore are in `game-content.js`.

## Flutter mobile client

Pengalaman utama mobile ada di folder [`mobile/`](./mobile/), memakai Flutter/Dart. Backend Node tetap menjadi sumber kebenaran untuk session, Guardian, kartu, encounter, dan reward; Flutter tidak menghitung XP/loot sendiri. Client native saat ini mencakup login/register bearer token, rotating refresh token, QR scan, App Links routing, card claim selection, Guardian roster/profile, dan prototype Camp Khar.

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=RIFT_API_BASE_URL=https://rift.pascadigital.my.id
```

Android App Links dan iOS Universal Links memakai `https://rift.pascadigital.my.id/card/<token>`. Publish `public/.well-known/assetlinks.json` dengan fingerprint signing Android yang benar dan `public/.well-known/apple-app-site-association` dengan Apple Team ID sebelum release store. Placeholder association files sengaja tidak dianggap production-ready. QR sudah diimplementasikan; NFC NDEF reader dan Flame overworld masih milestone berikutnya yang harus diuji pada perangkat fisik.

## Tests and audits

```bash
npm run check
npm test
npm audit --omit=dev
```

Tests use an isolated temporary SQLite file. Manual/browser playtesting is still required for animation feel, responsive controls, and balance.

## Beta limitations — not yet production-certified

This repository is **public-beta foundation, not a security certification or finished commercial production service**. Before onboarding public users, complete at least:

- Deploy behind managed HTTPS and configure trusted proxy/origin, secure secrets, persistent encrypted backups, restore drills, monitoring, and incident response.
- Replace in-memory per-process rate limits with a shared limiter; add account recovery, email verification, abuse reporting, privacy/terms, retention policy, and admin audit logs.
- Add tests/security review for card transfer/revoke workflows, first-claim race conditions, CSRF and deployment proxy config.
- NFC authenticity needs a cryptographic secure tag and challenge/response if the physical chip must be tamper-resistant; common NTAG URL tags are copyable.
- Reward economy and combat are early balance values. Playtest with real participants before issuing saleable cards.
- Card fulfillment must protect unclaimed QR/NFC URLs; the first person who claims a copied URL could become its owner.
- SQLite is appropriate for a single-node beta; use managed PostgreSQL for multi-instance scale.

## Reference skills reviewed

Local read-only references inspected without installing/executing anything:

- Game Studio browser-game planning: `C:/Users/KOMERCE-058/.codex/.tmp/plugins/plugins/game-studio/skills/game-studio/SKILL.md` (Phaser as default for 2D browser games; unify design, UI, assets, playtests).
- Gameplay design checklist: `C:/Users/KOMERCE-058/.codebuddy/plugins/marketplaces/codebuddy-plugins-official/plugins/godot-mcp/skills/godot-dev/level-3-orchestrators/game-planning/gameplay-design/SKILL.md` (core loop, combat, progression, quests, inventory; example numbers are illustrative).

No skill or downloaded asset package was installed from an untrusted source.
