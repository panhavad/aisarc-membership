# AISARC Membership – Test Report

> Generated automatically by `npm test` (`test/run.js`). Don’t edit by hand – run the tests again to refresh it.

| | |
| --- | --- |
| Application version | **1.8.0** (commit `f45112c`) |
| Date | 2026-11-12 18:53 UTC |
| Environment | Node.js v26.13.0 on win32 x64 – temporary test database, real HTTP server |
| Result | **✅ 89 passed, 0 failed** (89 checks) |

## Summary by area

| Area | Passed | Failed | Not run |
| --- | :---: | :---: | :---: |
| Platform & configuration | 4 | 0 | 0 |
| Registration & profile | 10 | 0 | 0 |
| Membership workflow | 8 | 0 | 0 |
| Administration | 6 | 0 | 0 |
| Events | 10 | 0 | 0 |
| Settings, levels & change requests | 6 | 0 | 0 |
| Duplicates & filtered export | 4 | 0 | 0 |
| Privacy & data-protection rights | 7 | 0 | 0 |
| Backup & restore | 4 | 0 | 0 |
| Security – access control | 5 | 0 | 0 |
| Security – authentication & sessions | 9 | 0 | 0 |
| Security – web & uploads | 8 | 0 | 0 |
| Data retention | 2 | 0 | 0 |
| Security – HTTPS mode | 2 | 0 | 0 |
| Supply chain & repository | 4 | 0 | 0 |

## Detailed results

### Platform & configuration

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| P-01 | Health check reports the app version | ✅ Pass | 3 ms |
| P-02 | Public config exposes only version and public Google settings (no secrets) | ✅ Pass | 4 ms |
| P-03 | App, privacy notice and self-hosted fonts are served; no Google Fonts | ✅ Pass | 27 ms |
| P-04 | Bootstrap admin from .env is forced to change its password | ✅ Pass | 0 ms |

### Registration & profile

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| R-01 | Registration creates a DRAFT applicant and signs them in | ✅ Pass | 195 ms |
| R-02 | Registration requires accepting the declaration | ✅ Pass | 5 ms |
| R-03 | Registration requires accepting the privacy notice | ✅ Pass | 4 ms |
| R-04 | Consent and privacy acceptance are recorded with time and version | ✅ Pass | 4 ms |
| R-05 | Duplicate email is refused with a generic message | ✅ Pass | 4 ms |
| R-06 | Invalid input is rejected (short password, bad email, missing name) | ✅ Pass | 12 ms |
| R-07 | Submitting an incomplete profile is refused and lists missing items | ✅ Pass | 6 ms |
| R-08 | Member can edit own profile; Khmer digits are normalised (១២ឆ្នាំ → 12) | ✅ Pass | 12 ms |
| R-09 | Complete profile + photo can be submitted → REVIEW | ✅ Pass | 20 ms |
| R-10 | Members cannot change protected fields (status, membership no., dates, login email) | ✅ Pass | 8 ms |

### Membership workflow

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| W-01 | Moderator sees the applicant in the review queue | ✅ Pass | 4 ms |
| W-02 | Reject needs a reason ("other" needs a message); rejection is stored | ✅ Pass | 14 ms |
| W-03 | Rejected member sees the reason and can resubmit | ✅ Pass | 8 ms |
| W-04 | Approval assigns membership no., member-since and validity | ✅ Pass | 8 ms |
| W-05 | Moderator cannot review a member who is not waiting for review | ✅ Pass | 3 ms |
| W-06 | Expired membership becomes PENDING; renewal request goes to REVIEW | ✅ Pass | 23 ms |
| W-07 | "Not agree" makes the member INACTIVE and records when consent changed | ✅ Pass | 21 ms |
| W-08 | Admin can deactivate and re-activate; validity is kept while still valid | ✅ Pass | 18 ms |

### Administration

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| A-01 | Admin can create, edit and search members | ✅ Pass | 20 ms |
| A-02 | Excel export: all members and selected members | ✅ Pass | 82 ms |
| A-03 | System users: create a moderator, change role, remove | ✅ Pass | 291 ms |
| A-04 | An admin cannot remove or demote themself (last-admin protection) | ✅ Pass | 25 ms |
| A-05 | Delete requires typed confirmation and also removes the login | ✅ Pass | 684 ms |
| A-06 | Association info: admins edit (incl. payment QR), members read | ✅ Pass | 21 ms |

### Events

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| E-01 | Staff create events; phases are upcoming / happening now / past | ✅ Pass | 22 ms |
| E-02 | Google Maps: automatic search link; only real Google Maps URLs accepted | ✅ Pass | 24 ms |
| E-03 | ACTIVE member joins; seat limit enforced; seat can be cancelled | ✅ Pass | 716 ms |
| E-04 | Cannot join events that started or ended; non-ACTIVE members cannot join | ✅ Pass | 230 ms |
| E-05 | Privacy: members see only the participant count; staff see names | ✅ Pass | 14 ms |
| E-06 | Seat changes validated; members cannot create events | ✅ Pass | 13 ms |
| E-07 | Price and "registration closes N days before": closed events refuse new joiners | ✅ Pass | 32 ms |
| E-08 | Payment proof: joined member uploads a bill; only the member and staff can open it | ✅ Pass | 781 ms |
| E-09 | Joiner list export to Excel (staff only): name, ID, gender, workplace, training, bill link | ✅ Pass | 20 ms |
| E-10 | Cancelling the seat deletes the payment proof file | ✅ Pass | 8 ms |

### Settings, levels & change requests

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| G-01 | Settings are admin-only and validated | ✅ Pass | 26 ms |
| G-02 | Member levels: admin assigns; unknown levels ignored; removed level falls back to member | ✅ Pass | 569 ms |
| G-03 | After the edit window the profile is locked (consent stays editable) | ✅ Pass | 811 ms |
| G-04 | Change request per section: admin rejects (reason required) or approves (applied) | ✅ Pass | 56 ms |
| G-05 | Annual renewal date: memberships older than the last renewal date become PENDING | ✅ Pass | 1031 ms |
| G-06 | Auto-INACTIVE after N years PENDING (daily job), with reason, audited | ✅ Pass | 1097 ms |

### Duplicates & filtered export

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| X-01 | Possible duplicates are flagged (same phone / email / name) and filterable | ✅ Pass | 29 ms |
| X-02 | "Not a duplicate" hides the flag for that pair (admin only) | ✅ Pass | 22 ms |
| X-03 | Import: a second response with a used email is kept as a flagged REVIEW record without login; re-import skips | ✅ Pass | 672 ms |
| X-04 | Members export follows the current search and filter | ✅ Pass | 94 ms |

### Privacy & data-protection rights

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| D-01 | Right of access: member downloads all their data as JSON (no password hash) | ✅ Pass | 6 ms |
| D-02 | Right to erasure: request, admin sees it, member can cancel | ✅ Pass | 26 ms |
| D-03 | Privacy notice acceptance is recorded (version + time) | ✅ Pass | 11 ms |
| D-04 | Audit log records staff access, changes, exports and decisions | ✅ Pass | 15 ms |
| D-05 | Audit log stores field names only, never the personal values | ✅ Pass | 24 ms |
| D-06 | Only admins can read the audit log | ✅ Pass | 6 ms |
| D-07 | Imported members: consent recorded from the Google Form, no default password | ✅ Pass | 453 ms |

### Backup & restore

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| B-01 | Admin downloads plain and passphrase-encrypted backups | ✅ Pass | 263 ms |
| B-02 | Restore refuses junk, missing passphrase and wrong passphrase | ✅ Pass | 180 ms |
| B-03 | Encrypted restore works, signs everyone out and keeps the audit log | ✅ Pass | 367 ms |
| B-04 | A backup without any admin account is refused | ✅ Pass | 3 ms |

### Security – access control

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-01 | Anonymous requests to every protected API are refused (401) | ✅ Pass | 33 ms |
| S-02 | Members cannot use staff or admin APIs (403) | ✅ Pass | 28 ms |
| S-03 | Moderators cannot use admin-only APIs (403) | ✅ Pass | 15 ms |
| S-04 | IDOR: a member cannot open another member’s files | ✅ Pass | 453 ms |
| S-05 | Mass assignment and prototype keys are ignored | ✅ Pass | 7 ms |

### Security – authentication & sessions

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-10 | Passwords are stored only as scrypt hashes | ✅ Pass | 7 ms |
| S-11 | SQL-injection style input does not bypass login or damage data | ✅ Pass | 157 ms |
| S-12 | Brute force: account locks after 10 failures even if the attacker changes IP | ✅ Pass | 1452 ms |
| S-13 | Registration is rate-limited per IP | ✅ Pass | 733 ms |
| S-14 | Session cookie is HttpOnly + SameSite=Lax; tampered cookies are rejected | ✅ Pass | 168 ms |
| S-15 | Logout and password change revoke the sessions on every device | ✅ Pass | 1168 ms |
| S-16 | Temporary passwords: must be changed (server-enforced) and expire after 72 h | ✅ Pass | 754 ms |
| S-17 | A role change revokes that user’s existing sessions | ✅ Pass | 522 ms |
| S-18 | Google sign-in disabled unless configured; callback verifies its CSRF token | ✅ Pass | 9 ms |

### Security – web & uploads

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-20 | Security headers: CSP, frame denial, nosniff, referrer, permissions, no-store API | ✅ Pass | 10 ms |
| S-21 | No inline event handlers or inline scripts in the front end (XSS hardening) | ✅ Pass | 5 ms |
| S-22 | Stored XSS payloads are returned as JSON data, never as HTML | ✅ Pass | 6 ms |
| S-23 | CSRF: form-encoded or text/plain POSTs to the API are refused (415) | ✅ Pass | 3 ms |
| S-24 | Uploads: disguised HTML, SVG, unknown fields and oversized files are rejected | ✅ Pass | 138 ms |
| S-25 | Served files are sandboxed; path traversal is impossible | ✅ Pass | 24 ms |
| S-26 | No error details or stack traces are sent to clients | ✅ Pass | 7 ms |
| S-27 | Source code, secrets and the database cannot be downloaded | ✅ Pass | 32 ms |

### Data retention

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| T-01 | Unsubmitted applications older than 12 months are deleted automatically | ✅ Pass | 1337 ms |
| T-02 | Audit entries older than 2 years are purged | ✅ Pass | 1167 ms |

### Security – HTTPS mode

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| H-01 | With an https PUBLIC_URL the cookie is Secure and HSTS is sent | ✅ Pass | 251 ms |
| H-02 | Google redirect URI defaults to PUBLIC_URL/auth/google/callback | ✅ Pass | 3 ms |

### Supply chain & repository

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| C-01 | No known vulnerabilities in production dependencies (npm audit, or OSV database) | ✅ Pass | 18781 ms |
| C-02 | Secrets and personal data are excluded from git and the Docker image | ✅ Pass | 7 ms |
| C-03 | No secrets, spreadsheets, databases or keys are tracked in git | ✅ Pass | 174 ms |
| C-04 | Docker: non-root, read-only filesystem, no capabilities; app never gets GIT_TOKEN | ✅ Pass | 3 ms |

## Compliance mapping

How the automated checks map to personal-data protection principles (details in [DATA-PROTECTION.md](DATA-PROTECTION.md)).

| Principle | Control in the system | Verified by |
| --- | --- | --- |
| Lawfulness & consent | Declaration and privacy notice must be accepted; time and version recorded; consent can be withdrawn | R-02, R-03, R-04, W-07, D-03, D-07 |
| Transparency | Bilingual, versioned privacy notice readable without an account; members asked again when it changes | P-03, D-03 |
| Purpose limitation & data minimisation | Members see only their own data; event lists show counts only; joiner details, bills and exports staff-only; settings and backups admin-only; no third-party fonts | P-03, E-05, E-08, E-09, S-02, S-03, G-01 |
| Accuracy | Members correct their own data; after the edit window via change requests reviewed by an admin; duplicate records are flagged | R-08, A-01, G-03, G-04, X-01 … X-03 |
| Storage limitation | Unsubmitted applications deleted after 12 months; audit log 2 years; server safety backups 90 days; payment proofs deleted with the seat or event | T-01, T-02, E-10 |
| Integrity & confidentiality | Hashed passwords, role-based access, session revocation, rate limits, CSP, upload checks, encrypted backups, owner/staff-only bill files | S-01 … S-27, B-01 … B-04, H-01, E-08 |
| Accountability | Audit log of access, changes, exports, backups, deletions, change-request decisions and automatic status changes (field names only) | D-04, D-05, D-06, B-03, E-09, G-04, G-06 |
| Data-subject rights | Download own data, correct (directly or by change request), withdraw consent at any time (also when locked), request deletion | D-01, D-02, R-08, W-07, G-03, G-04 |

## Verified manually in a browser

Checked in Microsoft Edge (headless, phone and desktop sizes) during development:

- All pages render under the strict Content-Security-Policy with **no CSP violations**; the self-hosted Khmer font loads.
- Stored XSS payloads (`<img onerror>`, `<script>`, `<svg onload>`) in event and member fields are shown as text and **never execute**.
- Registration → profile completion → submit, the system tour and the **?** button work on a phone-sized screen.
- Event sections (happening now / upcoming / past) and the Google Maps button.
- v1.8: logo-blue and level-coloured cards, locked profile with per-section change requests, admin settings and levels editor,
  duplicate flags and filter, event price / registration deadline / payment-proof upload, joiner list and Excel export.

## How to run

```bash
npm install
npm test        # writes docs/TEST-REPORT.md; exits non-zero if anything fails
```
