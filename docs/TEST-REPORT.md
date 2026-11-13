# AISARC Membership – Test Report

> Generated automatically by `npm test` (`test/run.js`). Don’t edit by hand – run the tests again to refresh it.

| | |
| --- | --- |
| Application version | **1.9.1** (commit `cde201e`) |
| Date | 2026-11-13 08:13 UTC |
| Environment | Node.js v26.13.0 on win32 x64 – temporary test database, real HTTP server |
| Result | **PASSED – 97 passed, 0 failed** (97 checks) |

## Summary by area

| Area | Passed | Failed | Not run |
| --- | :---: | :---: | :---: |
| Platform & configuration | 5 | 0 | 0 |
| Registration & profile | 11 | 0 | 0 |
| Membership workflow | 8 | 0 | 0 |
| Administration | 9 | 0 | 0 |
| Events | 10 | 0 | 0 |
| Settings, levels & change requests | 6 | 0 | 0 |
| Duplicates & filtered export | 4 | 0 | 0 |
| Privacy & data-protection rights | 8 | 0 | 0 |
| Backup & restore | 4 | 0 | 0 |
| Security – access control | 5 | 0 | 0 |
| Security – authentication & sessions | 9 | 0 | 0 |
| Security – web & uploads | 8 | 0 | 0 |
| Data retention | 3 | 0 | 0 |
| Security – HTTPS mode | 2 | 0 | 0 |
| Supply chain & repository | 5 | 0 | 0 |

## Detailed results

### Platform & configuration

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| P-01 | Health check reports the app version | Pass | 41 ms |
| P-02 | Public config exposes only version and public Google settings (no secrets) | Pass | 9 ms |
| P-03 | App, privacy notice and self-hosted fonts are served; no Google Fonts | Pass | 114 ms |
| P-04 | Bootstrap admin from .env is forced to change its password | Pass | 3 ms |
| P-05 | Deploys show up at once: JS/CSS load from a build-specific URL; the page itself is never cached | Pass | 102 ms |

### Registration & profile

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| R-01 | Registration creates a DRAFT applicant and signs them in | Pass | 580 ms |
| R-02 | Registration requires accepting the declaration | Pass | 13 ms |
| R-03 | Registration requires accepting the privacy notice | Pass | 10 ms |
| R-04 | Consent and privacy acceptance are recorded with time and version | Pass | 7 ms |
| R-05 | Duplicate email is refused with a generic message | Pass | 7 ms |
| R-06 | Invalid input is rejected (short password, bad email, missing name) | Pass | 19 ms |
| R-07 | Submitting an incomplete profile is refused and lists missing items | Pass | 7 ms |
| R-08 | Member can edit own profile; Khmer digits are normalised (១២ឆ្នាំ → 12) | Pass | 15 ms |
| R-09 | Complete profile + photo can be submitted → REVIEW | Pass | 52 ms |
| R-10 | Members cannot change protected fields (status, membership no., dates, login email) | Pass | 17 ms |
| R-11 | Place of birth and current address accept only one of Cambodia’s 25 provinces | Pass | 20 ms |

### Membership workflow

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| W-01 | Moderator sees the applicant in the review queue | Pass | 10 ms |
| W-02 | Reject needs a reason ("other" needs a message); rejection is stored | Pass | 27 ms |
| W-03 | Rejected member sees the reason and can resubmit | Pass | 18 ms |
| W-04 | Approval assigns membership no., member-since and validity | Pass | 22 ms |
| W-05 | Moderator cannot review a member who is not waiting for review | Pass | 6 ms |
| W-06 | Expired membership becomes PENDING; renewal request goes to REVIEW | Pass | 40 ms |
| W-07 | "Not agree" makes the member INACTIVE and records when consent changed | Pass | 38 ms |
| W-08 | Admin can deactivate and re-activate; validity is kept while still valid | Pass | 35 ms |

### Administration

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| A-01 | Admin can create, edit and search members | Pass | 32 ms |
| A-02 | Excel export: all members and selected members | Pass | 145 ms |
| A-03 | System users: create a moderator, change role, remove | Pass | 1138 ms |
| A-04 | An admin cannot remove or demote themself (last-admin protection) | Pass | 41 ms |
| A-05 | Delete requires typed confirmation and also removes the login | Pass | 1188 ms |
| A-06 | Association info: admins edit (incl. payment QR), members read | Pass | 40 ms |
| A-07 | Members list is paged on the server (10 by default; 20 / 50) with chip counts and slim rows | Pass | 170 ms |
| A-08 | Admin / moderator accounts can have a sign-in email (valid, unique, not on member accounts) | Pass | 1006 ms |
| A-09 | One email, two accounts (member + admin): after signing in the person chooses the account | Pass | 3331 ms |

### Events

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| E-01 | Staff create events; phases are upcoming / happening now / past | Pass | 27 ms |
| E-02 | Google Maps: automatic search link; only real Google Maps URLs accepted | Pass | 24 ms |
| E-03 | ACTIVE member joins; seat limit enforced; seat can be cancelled | Pass | 961 ms |
| E-04 | Cannot join events that started or ended; non-ACTIVE members cannot join | Pass | 313 ms |
| E-05 | Privacy: members see only the participant count; staff see names | Pass | 19 ms |
| E-06 | Seat changes validated; members cannot create events | Pass | 11 ms |
| E-07 | Price and "registration closes N days before": closed events refuse new joiners | Pass | 29 ms |
| E-08 | Payment proof: joined member uploads a bill; only the member and staff can open it | Pass | 865 ms |
| E-09 | Joiner list export to Excel (staff only): name, ID, gender, workplace, training, bill link | Pass | 26 ms |
| E-10 | Cancelling the seat deletes the payment proof file | Pass | 125 ms |

### Settings, levels & change requests

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| G-01 | Settings are admin-only and validated | Pass | 42 ms |
| G-02 | Member levels: admin assigns; unknown levels ignored; removed level falls back to member | Pass | 979 ms |
| G-03 | After the edit window the profile is locked (consent stays editable) | Pass | 1764 ms |
| G-04 | Change request per section: admin rejects (reason required) or approves (applied) | Pass | 203 ms |
| G-05 | Annual renewal date: memberships older than the last renewal date become PENDING | Pass | 3356 ms |
| G-06 | Auto-INACTIVE after N years PENDING (daily job), with reason, audited | Pass | 3370 ms |

### Duplicates & filtered export

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| X-01 | Possible duplicates are flagged (same phone / email / name) and filterable | Pass | 64 ms |
| X-02 | "Not a duplicate" hides the flag for that pair (admin only) | Pass | 74 ms |
| X-03 | Import: a second response with a used email is kept as a flagged REVIEW record without login; re-import skips | Pass | 2156 ms |
| X-04 | Members export follows the current search and filter | Pass | 459 ms |

### Privacy & data-protection rights

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| D-01 | Right of access: member downloads all their data as JSON (no password hash) | Pass | 16 ms |
| D-02 | Right to erasure: request, admin sees it, member can cancel | Pass | 73 ms |
| D-03 | Privacy notice acceptance is recorded (version + time) | Pass | 27 ms |
| D-04 | Audit log records staff access, changes, exports and decisions | Pass | 37 ms |
| D-05 | Audit log stores field names only, never the personal values | Pass | 41 ms |
| D-06 | Only admins can read the audit log | Pass | 11 ms |
| D-06b | Audit log returns only the last hour by default; older entries only when the admin asks | Pass | 63 ms |
| D-07 | Imported members: consent recorded from the Google Form, no default password | Pass | 1011 ms |

### Backup & restore

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| B-01 | Admin downloads plain and passphrase-encrypted backups | Pass | 609 ms |
| B-02 | Restore refuses junk, missing passphrase and wrong passphrase | Pass | 564 ms |
| B-03 | Encrypted restore works, signs everyone out and keeps the audit log | Pass | 812 ms |
| B-04 | A backup without any admin account is refused | Pass | 5 ms |

### Security – access control

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-01 | Anonymous requests to every protected API are refused (401) | Pass | 62 ms |
| S-02 | Members cannot use staff or admin APIs (403) | Pass | 41 ms |
| S-03 | Moderators cannot use admin-only APIs (403) | Pass | 25 ms |
| S-04 | IDOR: a member cannot open another member’s files | Pass | 775 ms |
| S-05 | Mass assignment and prototype keys are ignored | Pass | 9 ms |

### Security – authentication & sessions

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-10 | Passwords are stored only as scrypt hashes | Pass | 12 ms |
| S-11 | SQL-injection style input does not bypass login or damage data | Pass | 205 ms |
| S-12 | Brute force: account locks after 10 failures even if the attacker changes IP | Pass | 4108 ms |
| S-13 | Registration is rate-limited per IP | Pass | 1273 ms |
| S-14 | Session cookie is HttpOnly + SameSite=Lax; tampered cookies are rejected | Pass | 258 ms |
| S-15 | Logout and password change revoke the sessions on every device | Pass | 3151 ms |
| S-16 | Temporary passwords: must be changed (server-enforced) and expire after 72 h | Pass | 1478 ms |
| S-17 | A role change revokes that user’s existing sessions | Pass | 771 ms |
| S-18 | Google sign-in disabled unless configured; callback verifies its CSRF token | Pass | 11 ms |

### Security – web & uploads

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| S-20 | Security headers: CSP, frame denial, nosniff, referrer, permissions, no-store API | Pass | 7 ms |
| S-21 | No inline event handlers or inline scripts in the front end (XSS hardening) | Pass | 5 ms |
| S-22 | Stored XSS payloads are returned as JSON data, never as HTML | Pass | 8 ms |
| S-23 | CSRF: form-encoded or text/plain POSTs to the API are refused (415) | Pass | 6 ms |
| S-24 | Uploads: disguised HTML, SVG, unknown fields and oversized files are rejected | Pass | 300 ms |
| S-25 | Served files are sandboxed; path traversal is impossible | Pass | 48 ms |
| S-26 | No error details or stack traces are sent to clients | Pass | 16 ms |
| S-27 | Source code, secrets and the database cannot be downloaded | Pass | 25 ms |

### Data retention

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| T-01 | Unsubmitted applications older than 12 months are deleted automatically | Pass | 3061 ms |
| T-02 | Audit entries older than 2 years are purged | Pass | 1909 ms |
| T-03 | Free-text place of birth / address from older data is mapped to a province (original kept for admins) | Pass | 1778 ms |

### Security – HTTPS mode

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| H-01 | With an https PUBLIC_URL the cookie is Secure and HSTS is sent | Pass | 473 ms |
| H-02 | Google redirect URI defaults to PUBLIC_URL/auth/google/callback | Pass | 5 ms |

### Supply chain & repository

| ID | Check | Result | Time |
| --- | --- | --- | ---: |
| C-01 | No known vulnerabilities in production dependencies (npm audit, or OSV database) | Pass | 14049 ms |
| C-02 | Secrets and personal data are excluded from git and the Docker image | Pass | 3 ms |
| C-03 | No secrets, spreadsheets, databases or keys are tracked in git | Pass | 211 ms |
| C-04 | Docker: non-root, read-only filesystem, no capabilities; app never gets GIT_TOKEN | Pass | 3 ms |
| C-05 | No emoji or symbol characters in the interface or documentation (SVG icons only) | Pass | 28 ms |

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
