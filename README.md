# AISARC Membership Portal

Mobile-first membership management web app for **ស.គ.ឯ.ស.ប.ក – AISARC**.

- **Members** sign in with username/password or Google, see their live digital membership pass, and edit their own information.
- **New members** self-register (or sign in with Google); their application waits for a moderator.
- **Moderators** review applications and renewals (approve, or reject with a reason the member can act on) and manage events.
- **Admins** do everything: search, add, edit, activate/deactivate, delete (hidden in a "Danger zone"), assign roles,
  reset passwords, edit Association Info (bank account, fee, QR), export members to Excel (all or selected), and
  in the **Admin** tab create/remove system users (admins, moderators) and back up / restore the whole database.
- **Events**: admins and moderators post events (name, location, date/time, description, seats); ACTIVE members join
  or cancel; the joined count and participant list update live.
- "Member since" and membership no. are set by the system/admin and cannot be changed by members.

### Membership status

| Status | Colour | Meaning |
| --- | --- | --- |
| REVIEW | orange | Waiting for a moderator to approve or reject |
| PENDING | grey | Membership expired (validity set in Association Info); member must pay and request renewal |
| ACTIVE | green | Active, no action needed – blue pass with shine animation and live clock (not a screenshot) |
| REJECTED | red | Rejected by a moderator because information is missing or wrong (reason shown to the member) |
| INACTIVE | red | Member does not agree to the declaration (consent), or was deactivated by an admin |

Any status other than ACTIVE shows a grey pass.

Tech: Node.js 24 + Express, built-in `node:sqlite` (no native deps), vanilla JS front end (no build step, ~45 KB of app code), on `node:24-alpine`.

## Quick start (local)

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD='<a-long-random-password>' COOKIE_SECURE=false npm run dev   # http://localhost:3000
npm run import -- "path/to/responses.xlsx"                       # load members
```

## Deploy with Docker Compose (auto-update on git push)

On the server:

```bash
git clone <your-repo-url> aisarc && cd aisarc
cp .env.example .env            # edit ADMIN_PASSWORD, SESSION_SECRET, GOOGLE_CLIENT_ID ...
docker compose up -d --build
# import the member spreadsheet once
docker compose cp members.xlsx app:/tmp/members.xlsx
docker compose exec app node scripts/import.js /tmp/members.xlsx
```

The `updater` service checks the git remote every `POLL_INTERVAL` seconds (default 60). When you
`git push` to `GIT_BRANCH` (default `main`), it pulls, rebuilds and restarts the `app` container.
Member data lives in the `aisarc-data` Docker volume and survives updates.

- **Private repo over HTTPS**: set `GIT_USERNAME` and `GIT_TOKEN` (read-only token: GitHub fine-grained token with
  *Contents: Read-only*, or a GitLab deploy token) and optionally `GIT_REPO_URL` in `.env`. The token is passed to git
  through a credential helper and is never stored in the repository config or shown in logs.
- **Private repo over SSH**: put a read-only deploy key (`id_ed25519`, mode 600) and `known_hosts` in a folder and set `SSH_KEY_DIR` in `.env`.
- Logs: `docker compose logs -f updater`

### HTTPS + Google Sign-In

1. Point your domain at the server, set `DOMAIN=members.example.org`, `PUBLIC_URL=https://members.example.org`
   and `COOKIE_SECURE=true` in `.env`.
2. `docker compose --profile https up -d` (Caddy gets a Let's Encrypt certificate automatically).
3. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID (Web application)**:
   - *Authorized JavaScript origins*: `https://members.example.org`
   - *Authorized redirect URIs*: `https://members.example.org/auth/google/callback`

   Then set `GOOGLE_CLIENT_ID` (and optionally `GOOGLE_REDIRECT_URI`, which defaults to `${PUBLIC_URL}/auth/google/callback`).
   With a redirect URI the sign-in uses a full-page redirect, which also works in in-app browsers (Telegram, Facebook)
   where popups are blocked. Without `PUBLIC_URL`/`GOOGLE_REDIRECT_URI` the Google popup is used.
4. Members sign in with the Google account whose email matches their member record; unknown Google accounts are
   registered as new applicants (status REVIEW). Add admin Google accounts to `ADMIN_EMAILS`.

### Troubleshooting

- `Cannot read package config /app/package.json: permission denied` – fixed in the Dockerfile (app files are copied
  with `--chown=node:node`). Pull the latest code and run `docker compose up -d --build`.

## Accounts

| Who | Username | Initial password |
| --- | --- | --- |
| First admin | `ADMIN_USERNAME` | `ADMIN_PASSWORD` from `.env` (only if no admin exists yet) – must be changed at first sign-in |
| Imported member | their email | none – sign in with Google (same email), or ask an admin for a temporary password |
| Self-registered member | their email | chosen at registration |

Admins can generate a temporary password for any member (valid 72 hours, must be changed at first sign-in), and make
a member a **moderator** or **admin** from the member's page (Account → Role). Google accounts listed in
`ADMIN_EMAILS` are admins.

## Security

- **Passwords:** scrypt (N=2^15, per-password salt), checked in constant time without blocking the server; older hashes
  are upgraded at the next sign-in.
- **Temporary passwords:** expire after 72 hours. "Must change password" is enforced by the server.
- **Sessions:** HMAC-signed, HttpOnly, SameSite=Lax cookie, `Secure` automatically on https, 14-day lifetime.
  Logout, password change, admin reset and role change revoke all of that user's sessions; a restore signs everyone out.
- **Rate limits:** 10 failed sign-ins per account and 30 per IP per 15 minutes, and 5 registrations per IP.
  `X-Forwarded-For` is only trusted from loopback/private proxies (`TRUST_PROXY`).
- **Email ownership:** the login email can only be changed by an admin. Signing in with Google proves ownership; if the
  account was registered by someone who hadn't proven it, any password they set is removed.
- **Uploads:** only JPEG/PNG/WebP (and PDF certificates), checked against the real file content, max 8 MB, random file
  names, served only to the owner and staff with a sandboxing Content-Security-Policy.
- **Other protections:** strict Content-Security-Policy, HSTS, X-Frame-Options, `nosniff` and no-store caching for API
  responses. All SQL is parameterized, all output HTML-escaped, and no error details or stack traces reach clients
  (`NODE_ENV=production`).
- **Docker:** the app runs as a non-root user on a read-only filesystem with all Linux capabilities dropped. The updater
  only receives the git settings, and the app never sees `GIT_TOKEN`.
- **Auto-update risk:** anyone who can push to the watched branch can change what runs on the server. Keep the
  repository private, protect the branch, and give the updater a read-only token.
- **Backups:** contain all personal data and password hashes, so store downloaded backup files securely.

## Data

Fields follow the Google Form columns (`public/fields.js`). Photos/certificates uploaded in the app are stored in
the data volume and only visible to the member and staff.

**Backup / restore**: Admin tab → *Download backup* produces one `.json.gz` file with the whole database and all
uploaded files. *Restore* (inside the collapsed danger box) replaces everything with a backup file and signs everyone
out; a safety copy of the data before the restore is kept in `/data/backups` inside the `aisarc-data` volume.

The original Google Form spreadsheet can still be loaded once from the command line (there is no import button in the app):
`docker compose exec app node scripts/import.js /tmp/members.xlsx`.
