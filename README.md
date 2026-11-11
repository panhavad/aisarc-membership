# AISARC Membership Portal

Mobile-first membership management web app for **ស.គ.ឯ.ស.ប.ក – AISARC**.

- **Members** sign in with username/password or Google, see their live digital membership pass, and edit their own information.
- **New members** self-register (or sign in with Google); their application waits for a moderator.
- **Moderators** review applications and renewals: approve, or reject with a reason the member can act on.
- **Admins** do everything: search, add, edit, activate/deactivate, delete (hidden in a "Danger zone"), assign roles,
  reset passwords, edit Association Info (bank account, fee, QR), import the Google Form XLSX and export CSV.
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
ADMIN_USERNAME=admin ADMIN_PASSWORD=Admin12345 npm run dev      # http://localhost:3000
npm run import -- "path/to/responses.xlsx"                       # load members
```

## Deploy with Docker Compose (auto-update on git push)

On the server:

```bash
git clone <your-repo-url> aisarc && cd aisarc
cp .env.example .env            # edit ADMIN_PASSWORD, SESSION_SECRET, GOOGLE_CLIENT_ID ...
docker compose up -d --build
# import the member spreadsheet once (or use "Import" in the admin screen)
docker compose cp members.xlsx app:/tmp/members.xlsx
docker compose exec app node scripts/import.js /tmp/members.xlsx
```

The `updater` service checks the git remote every `POLL_INTERVAL` seconds (default 60). When you
`git push` to `GIT_BRANCH` (default `main`), it pulls, rebuilds and restarts the `app` container.
Member data lives in the `aisarc-data` Docker volume and survives updates.

- **Private repo over HTTPS**: clone with a read-only token, e.g. `https://<token>@github.com/org/aisarc.git`.
- **Private repo over SSH**: put a read-only deploy key (`id_ed25519`, mode 600) and `known_hosts` in a folder and set `SSH_KEY_DIR` in `.env`.
- Logs: `docker compose logs -f updater`

### HTTPS + Google Sign-In

1. Point your domain at the server, set `DOMAIN=members.example.org` and `COOKIE_SECURE=true` in `.env`.
2. `docker compose --profile https up -d` (Caddy gets a Let's Encrypt certificate automatically).
3. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID (Web)**, add
   `https://members.example.org` to *Authorized JavaScript origins*, and set `GOOGLE_CLIENT_ID` in `.env`.
4. Members sign in with the Google account whose email matches their member record; unknown Google accounts are
   registered as new applicants (status REVIEW). Add admin Google accounts to `ADMIN_EMAILS`.

## Accounts

| Who | Username | Initial password |
| --- | --- | --- |
| Admin | `ADMIN_USERNAME` | `ADMIN_PASSWORD` (from `.env`, created on first start) |
| Imported member | their email | their phone number (digits only) – must be changed at first login |
| Self-registered member | their email | chosen at registration |

Admins can generate a new temporary password for any member, and make a member a **moderator** or **admin**
from the member's page (Account → Role). Google accounts listed in `ADMIN_EMAILS` are admins.

## Data

Fields follow the Google Form columns (`public/fields.js`). Re-importing the XLSX adds new responses only;
choose *Overwrite* in the admin import to refresh existing members from the sheet. Photos/certificates
uploaded in the app are stored in the data volume and only visible to the member and admins.
Back up with `docker run --rm -v aisarc_aisarc-data:/d -v $PWD:/b alpine tar czf /b/aisarc-backup.tgz -C /d .`
