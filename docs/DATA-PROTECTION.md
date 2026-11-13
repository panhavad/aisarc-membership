# Data protection & compliance

This document describes how the AISARC Membership Portal protects members' personal data, what the association
(as the organisation responsible for the data) must do, and which risks remain. It accompanies the
[privacy notice](../PRIVACY.md) and the automated [test report](TEST-REPORT.md).

> **Not legal advice.** The system was designed to follow internationally recognised data-protection principles
> (lawfulness, consent, transparency, minimisation, storage limitation, security, accountability and data-subject
> rights – as in the EU GDPR and ASEAN data-protection frameworks). Cambodia's rules on personal data are still
> developing (for example the draft Law on Personal Data Protection and the data provisions of the Law on Electronic
> Commerce). **Before going live, have a Cambodian lawyer review the privacy notice, the declaration text and this
> document**, and check the Khmer translation.

---

## 1. Roles and responsibilities

| Role | Who | Responsibilities |
| --- | --- | --- |
| Data controller | AISARC (the association) | Decides why and how data is used; answers members' requests; notifies breaches. |
| Data-protection contact | Named by the board (put the contact in Association Info) | First contact for privacy questions, requests and incidents. |
| Admins | Accounts with the *admin* role | Manage members, exports, backups, deletion requests; review the audit log monthly. |
| Moderators | Accounts with the *moderator* role | Review applications and manage events; read-only access to member data. |
| Hosting provider | Server / VPS / Cloudflare | Processes data on AISARC's behalf; should have a written agreement covering confidentiality and security. |

---

## 2. Record of processing

| Data | Purpose | Legal basis | Who can see it | Retention |
| --- | --- | --- | --- | --- |
| Identity: names, gender, date of birth, age group, nationality, place of birth (province only) | Membership, digital pass, verification | Consent (declaration) + membership | Member, moderators, admins | While a member; deleted ≤ 30 days after a deletion request |
| Contact: current address (province only), phone, Telegram, email / Facebook | Contacting members | Consent + membership | Member, moderators, admins | As above |
| Professional: occupation, training, degrees, workplace, department, experience, council registration no. / date | Checking eligibility | Consent + membership | Member, moderators, admins | As above |
| Documents: photo, council certificate | Pass photo, verification | Consent | Member, moderators, admins (certificate views are logged) | As above |
| Account: email, password hash, role, sign-in method; optional sign-in email of admin / moderator accounts | Security, access control | Membership | Admins (hash never shown) | As above |
| Original free-text place of birth / address from the Google Form (`legacy_text`) | Checking the automatic province mapping | Membership (records) | Member (own data download), moderators, admins | Kept with the record; can be removed once the province is confirmed (data minimisation) |
| Membership: number, status, dates, level, review decisions, consent and privacy-notice records | Administration, proof of consent | Membership + legal obligation (records) | Member, moderators, admins | As above |
| Event participation | Organising events | Membership | Member (own), moderators, admins | As above |
| Event payment proofs (receipt photo / PDF uploaded by the member) | Checking event fees were paid | Membership (the member chooses to join a paid event) | Member (own), moderators, admins (views are logged; exports contain sign-in-protected links, not the images) | Deleted when the member cancels the seat or the event is deleted; otherwise as above |
| Change requests (old and new values per section, note, decision, reason) | Correcting locked profiles under admin control | Membership + accuracy of records | Member (own), admins | Kept with the record; uploaded files of rejected/cancelled requests are deleted immediately |
| Duplicate flags (`duplicate_email`, “not a duplicate” decisions) | Keeping one accurate record per person | Legitimate interest (accurate records) | Moderators, admins | As above |
| Audit log: time, staff account, action, record id, field **names**, IP address | Security and accountability | Legitimate interest (security) | Admins | 2 years, then deleted automatically |
| Unsubmitted applications (DRAFT) | Registration | Consent | Applicant, staff | Deleted automatically after 12 months without activity |
| Server safety backups (`/data/backups`) | Disaster recovery | Legitimate interest | Server administrator | 90 days, then deleted automatically |
| Downloaded backups and Excel exports | Admin work, disaster recovery | Legitimate interest | Whoever holds the file | **Must be managed by admins** – see section 6 |

No data is sold, used for advertising, or profiled. The only cookie is the essential sign-in cookie (no analytics,
no tracking). Fonts are served from the portal itself, so page visits are not reported to Google; Google is only
involved when a member chooses *Sign in with Google*, and for photo links imported from the original Google Form.

---

## 3. How members' rights are handled

| Right | How it works in the system | Deadline |
| --- | --- | --- |
| Be informed | Bilingual privacy notice at `/#/privacy`, linked on every page and required at registration | – |
| Access / portability | Profile → **My data & privacy → Download my data** (JSON with all stored data and the activity on their record) | Immediate |
| Correction | Members edit their profile during the edit window set by the admin (default 30 days after approval). After that the profile is locked and members send a **change request** per section; the admin approves (applied immediately) or rejects with a written reason. Consent can always be changed directly. Protected fields (membership no., dates, login email, level) are corrected by an admin | ≤ 30 days |
| Withdraw consent | Declaration → **Not agree**: membership becomes INACTIVE and the change is recorded with date and time | Immediate |
| Erasure | Profile → **Request deletion** → appears in Admin tab → *Privacy requests* with a due date; the admin deletes the record (Danger zone) | ≤ 30 days |
| Object / complain | Contact the association (Association tab) | ≤ 30 days |

When an admin deletes a member, their login, photo, certificate and event seats are removed immediately.
Copies inside older backups disappear when those backups expire (≤ 90 days on the server; admins must delete
downloaded backups on the same schedule).

---

## 4. Security measures (summary)

Technical details are in the [README security section](../README.md#security) and are verified by the
[test report](TEST-REPORT.md).

- Encrypted connections (HTTPS + HSTS); strict Content-Security-Policy; no third-party scripts except Google Sign-In.
- Passwords hashed with scrypt; no default or guessable passwords; temporary passwords expire after 72 hours.
- Role-based access control enforced on the server; members can only see their own data.
- Sessions revoked on logout, password change, password reset, role change and restore.
- Brute-force protection per account and per IP; registration rate limit.
- Upload checks (real file type, size limit), sandboxed file serving, random file names.
- **Audit log** of sign-ins, failed sign-ins, record views, changes, exports, backups, restores, role changes,
  deletions and privacy requests – it records field *names*, never the values.
- Encrypted backups (AES-256-GCM, passphrase) are offered; restore signs everyone out.
- Hardened container (non-root, read-only, no capabilities); secrets kept out of git and the image.

---

## 5. Data breach response plan

If personal data may have been exposed (lost laptop with an export, leaked backup, suspicious admin activity, server
compromise):

1. **Contain (same day).**
   - Change `SESSION_SECRET` in `.env` and restart: this signs everyone out.
   - Reset the passwords of affected staff accounts and remove unknown admin or moderator accounts (Admin tab).
   - If the server is compromised, take it offline and restore from a known-good encrypted backup on a clean server.
2. **Assess (within 24 h).** Use the **audit log** to find what was accessed or exported, by which account, when and
   from which IP. Decide which members and which data are affected.
3. **Notify (within 72 h where required).** Inform the affected members (and any authority required by law) in Khmer
   and English: what happened, which data, what we did, and what they should do (e.g. watch for phishing).
4. **Record.** Keep an incident record: date, cause, data affected, number of members, actions taken, notifications sent.
5. **Improve.** Fix the cause, then review the access rights and this plan.

---

## 6. Rules for admins and moderators

- Only use member data for association business. Never copy it into personal chats or groups, or share it with third parties.
- Use a strong, unique password. Prefer **Sign in with Google with 2-step verification** for admin accounts
  (`ADMIN_EMAILS`). Never share accounts.
- **Excel exports** contain personal data: export only what you need, keep the file on an encrypted device, never send it
  by public link, and delete it when the task is done.
- **Backups:** always set a passphrase, store the file and the passphrase separately, keep at most 90 days of backups,
  and delete older ones.
- Handle **deletion requests within 30 days** (Admin tab → Privacy requests).
- Answer **change requests** promptly (Admin tab → Change requests, or the *Change requests* filter in Members). When
  rejecting, write a clear reason – the member sees it.
- Check the **Duplicate** filter after imports: compare the records, delete the extra one (Danger zone), or mark
  "Not a duplicate".
- **Payment proofs** are only for checking event fees. Do not forward receipt images; the joiner Excel export contains
  links that require a staff sign-in, not the images themselves.
- Review the **audit log** monthly for unusual access, for example many record views or exports, or failed sign-ins.
- Remove staff accounts immediately when someone leaves their role.

---

## 7. Go-live checklist

- [ ] A lawyer has reviewed the privacy notice, the declaration and this document (Khmer and English).
- [ ] Association Info contains the data-protection contact (phone / email / Telegram).
- [ ] `PUBLIC_URL` uses https; the site is only reachable through HTTPS; HSTS header present.
- [ ] `SESSION_SECRET` is set to a long random value; `ADMIN_PASSWORD` is removed from `.env` after first sign-in.
- [ ] The server disk is encrypted, and the host is patched and only reachable over SSH with keys.
- [ ] `APP_BIND=127.0.0.1` if the reverse proxy runs on the same host.
- [ ] The repository is private, the branch is protected and the updater uses a read-only token.
- [ ] Admins have read section 6. A written agreement with the hosting provider is in place.
- [ ] `npm test` passes and `docs/TEST-REPORT.md` has been refreshed for the deployed version.
- [ ] Imported members have been informed about the portal and the privacy notice (they will be asked to accept it).

---

## 8. Remaining risks and recommendations

No system is risk-free. These items are known and either accepted or need an organisational decision:

| Risk | Status / recommendation |
| --- | --- |
| Photos and certificates from the **original Google Form** are stored in Google Drive and referenced by link. | Check the Drive sharing settings, so files are not "anyone with the link". Ask members to re-upload photos in the portal, then remove the Drive files. |
| Downloaded **backups and exports** leave the server's protection. | Covered by the staff rules in section 6; use backup passphrases. |
| Password registrations don't verify email ownership by email message. | Mitigated: Google sign-in proves ownership and removes any password set by someone else; login emails can only be changed by admins. Adding email verification would need an email service (SMTP). |
| No built-in 2-factor authentication for password logins. | Use Google sign-in with 2-step verification for admin accounts. |
| Anyone can find out whether an email is registered (registration message). | Low risk; registrations are rate-limited. |
| Anyone who can push to the git branch can change the running system. | Keep the repository private, protect the branch, and limit who has push access. |
| The data-protection law in Cambodia may change. | Review this document at least once a year, or when the law changes. |
