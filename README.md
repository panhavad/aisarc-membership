# AISARC Membership Portal

Mobile-first membership management web app for **ស.គ.ឯ.ស.ប.ក – AISARC**.

- **Members** sign in with username/password or Google, see their digital membership pass, and edit their own information.
- **Admins** search, view, add, edit, delete members, reset passwords, import the Google Form XLSX and export CSV.
- The **"Member since" timestamp**, membership no., status, login email, payment and consent fields are admin-only.

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
4. Members sign in with the Google account whose email matches their member record. Add admin Google accounts to `ADMIN_EMAILS`.

## Accounts

| Who | Username | Initial password |
| --- | --- | --- |
| Admin | `ADMIN_USERNAME` | `ADMIN_PASSWORD` (from `.env`, created on first start) |
| Imported member | their email | their phone number (digits only) – must be changed at first login |

Admins can generate a new temporary password for any member from the member's page.

## Data

Fields follow the Google Form columns (`public/fields.js`). Re-importing the XLSX adds new responses only;
choose *Overwrite* in the admin import to refresh existing members from the sheet. Photos/certificates
uploaded in the app are stored in the data volume and only visible to the member and admins.
Back up with `docker run --rm -v aisarc_aisarc-data:/d -v $PWD:/b alpine tar czf /b/aisarc-backup.tgz -C /d .`
