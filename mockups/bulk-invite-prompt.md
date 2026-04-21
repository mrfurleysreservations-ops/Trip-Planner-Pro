# Bulk Invite — Build Prompt

You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

## Feature
Add a **Bulk Invite** flow to the Group page that lets a host add up to 20 people to a trip at once. The existing single-invite card at the top of the Friends tab must not change in any way.

## Where it lives
- Page: `app/trip/[id]/group/group-page.tsx` (Friends tab, inside the "✉️ Invite someone new" card)
- The single-invite card stays **exactly** as it is today. Do not touch its JSX, state, validation, or styling.

## What to add

### 1. Entry point — a single line below the existing "Send Invite" row
Inside the same bordered section as the existing invite form, directly below the row containing `[Name] [Email] [Send Invite]`, add one line of helper text:

```
Inviting a group? Add up to 20 people at once →
```

- "Add up to 20 people at once →" is an `<a href="#">` styled with `color: th.accent`, `fontWeight: 600`, `textDecoration: "none"`.
- Leading "Inviting a group?" is `fontSize: 12px; color: th.muted; fontWeight: 500`.
- Top margin `10px` so it sits cleanly under the existing send-invite row.
- Clicking it opens the bulk modal (below). Prevent default on the `onClick`.

### 2. Modal — must match the app's canonical modal pattern
**Reference implementation:** `app/trip/[id]/trip-page.tsx` → "Add Booking Modal" (around line 1095). Copy its skeleton exactly. Do not invent a new modal style — every modal in this app must look the same.

Required structure:
- **Backdrop:** `position: fixed; inset: 0; zIndex: 1000; background: rgba(0,0,0,0.45); display: flex; alignItems: flex-end; justifyContent: center; animation: fadeIn 0.15s ease-out`. Clicking the backdrop closes the modal.
- **Sheet:** `width: 100%; maxWidth: 480px; maxHeight: 90vh; borderRadius: 20px 20px 0 0; boxShadow: 0 -8px 40px rgba(0,0,0,0.2); background: th.bg; animation: slideUp 0.2s ease-out; display: flex; flexDirection: column`. `onClick={e => e.stopPropagation()}` so clicks inside don't close it.
- **Sticky header** inside the sheet: `position: sticky; top: 0; padding: 18px 20px 14px; borderBottom: 1px solid th.cardBorder; background: th.bg; borderRadius: 20px 20px 0 0`. Title: "✉️ Invite multiple people" in `fontFamily: 'Outfit'; fontWeight: 800; fontSize: 18px`. Below the title, a subtitle: "Up to 20 at once. Empty rows are skipped." in `fontSize: 11px; color: th.muted`. ✕ close button: `background: none; fontSize: 22px; color: th.muted; padding: 4px`.
- **Scrollable body:** `overflow-y: auto; padding: 14px 20px 14px; flex: 1`. Contains the 20 rows.
- **Sticky footer:** `position: sticky; bottom: 0; background: th.bg; padding: 12px 20px 14px; borderTop: 1px solid th.cardBorder; boxShadow: 0 -4px 12px rgba(0,0,0,0.04); display: flex; alignItems: center; justifyContent: space-between`. The sheet anchors to the viewport bottom (`alignItems: flex-end` on backdrop) so this footer sits in the spot the sub-nav normally occupies — exactly like Add Booking modal today.

Keyframes (add to the same `<style>` block the booking modal already uses, or reuse them — don't duplicate):
```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
```

### 3. Modal body — 20 rows
Each row is a CSS grid: `grid-template-columns: 22px 1fr 1fr 22px; gap: 6px; alignItems: center; marginBottom: 6px`.
- Column 1: row number (`1`–`20`), `fontSize: 11px; color: #bbb; fontWeight: 600; textAlign: right`
- Column 2: Name input — reuse `className="input-modern"` with `padding: 8px 10px; fontSize: 13px; borderRadius: 8px`, placeholder `"Name"`
- Column 3: Email input — same styling, placeholder `"Email"`, `type="email"`
- Column 4: per-row clear button (`×`), `background: transparent; border: none; color: #bbb; fontSize: 16px`. `visibility: hidden` by default; show only when the row has any content. Hover color `#d9534f`. Clicking wipes that single row.

State: hold rows in one `useState<BulkRow[]>` where `BulkRow = { name: string; email: string; emailInvalid: boolean; duplicate: boolean }`, initialized to 20 empty rows. Keep the array length fixed at 20 — don't push/pop.

### 4. Validation
- Email regex: reuse the same `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` the existing `sendExternalInvite` uses.
- Validate a row's email on blur (not on every keystroke — too noisy).
- Invalid email → input gets `border-color: #d9534f; boxShadow: 0 0 0 3px rgba(217,83,79,0.08)`.
- Duplicate: check against (a) every other filled row in the modal, case-insensitively, and (b) existing `members` that already have `email` set. Flag with the same invalid style.
- A row is "ready to send" only when: name non-empty AND email non-empty AND email passes regex AND email is not a duplicate.

### 5. Sticky footer status + CTAs
- Left side: live status text, `fontSize: 12px; color: #5a5a5a`. Format: `<strong>N</strong> ready to send`. If any rows have issues, append a red/orange clause: `· X missing name · X missing email · X invalid · X already on trip`. Don't suppress when `N=0` — show `0 ready to send` in that case.
- Right side: two buttons.
  - **Clear** — ghost style: `background: transparent; color: #777; border: 1.5px solid #e0e0e0`. Resets all 20 rows to empty.
  - **Send all** — primary style: `background: linear-gradient(135deg, ${th.accent} 0%, ${th.accent2} 100%); boxShadow: 0 2px 8px ${th.accent}4d`. Disabled when `readyCount === 0`. Label flips from "Send all" to `Send ${N} invite${N === 1 ? '' : 's'}`.

### 6. Send flow
On Send all click:
- Filter to ready rows only.
- For each ready row, do what `sendExternalInvite` already does: insert a `trip_members` row (`trip_id`, `name`, `email`, `role: 'member'`, `status: 'pending'`, `invited_by: userId`, `invite_token: crypto.randomUUID()`), then call `triggerInviteEmail(email, name)`. **Do not duplicate that logic** — extract the per-invite path out of `sendExternalInvite` into a small helper (e.g. `insertExternalMember(name, email)`) and have both the single-invite and bulk-invite flows call it.
- Run the bulk send with a concurrency cap of **5 in flight at a time** (simple `p-limit`-style loop) so we don't hammer the email API. No external dependency — write the tiny limiter inline.
- Optimistically update `members` state the same way `sendExternalInvite` does (appending one row per successful insert).
- Log a single activity entry: `action: "added"`, `entityType: "member"`, `entityName: "${successCount} people"`, `detail: "Bulk invite"`.
- If any row fails (DB insert error OR email fail), keep that row in the modal with a red indicator and a short error label under the row; successful rows are cleared and removed. Footer status then shows `X sent · Y failed — retry?`. Clicking "Send all" again retries only the still-present rows.
- When every row succeeds, close the modal and show a toast: `✓ Sent N invites`.

## What NOT to change
- The existing `sendExternalInvite` callable — preserve its external behavior, but refactor its body to call the new `insertExternalMember` helper.
- The existing Name/Email inputs, the Send Invite button, or the `inviteError` banner.
- Any other part of the Group page: crew chips, search, Your Friends, External invites greyed list, discovery, Families tab, subnav.
- `trip_members` schema. No SQL migration needed — every column we need already exists.

## Files to touch
- `app/trip/[id]/group/group-page.tsx` — add state (`showBulkModal`, `bulkRows`), the link under the existing form, and the modal JSX. Likely the new modal JSX is long enough to warrant extracting — if so, create `app/trip/[id]/group/bulk-invite-modal.tsx` as a client component and import it. Keep props minimal: `tripId`, `userId`, `theme`, `existingEmails: Set<string>`, `onClose`, `onSuccess(addedMembers: TripMember[])`.

## Acceptance checks before wrapping up
1. Single-invite flow still works identically (sanity test: add one external invite via the old form — DB row inserted, email fired, row appears in roster).
2. Bulk flow: fill 5 rows, hit Send all — 5 DB rows + 5 emails.
3. Edge: 1 row has an invalid email, 1 row duplicates an existing member — Send all skips both, warns in footer, does not crash.
4. Edge: close modal via backdrop tap, ✕ button, and Clear — all reset state correctly.
5. Visual diff against Add Booking modal — header, backdrop dim, slide-up animation, close button, rounded top corners, sticky footer should all feel identical.
6. Modal covers the sub-nav when open (same as every other modal today).

## When done
This is a solo hobby project — push straight to `main`, no branches, no PR. Sandbox git is locked and has no push creds, so at the end of the session, give me the exact commit + push commands to run locally. Summarize what changed in the commit message body.
