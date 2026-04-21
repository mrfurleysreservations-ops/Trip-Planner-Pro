# Build: Member Detail Modal on Group Tab

## Preamble
You are a senior staff-level engineer. Do NOT generate inconsistent patterns. Follow existing architecture strictly. If something is unclear, ask instead of guessing. Use clean, scalable, production-grade patterns only. Avoid duplication and unnecessary abstraction.

Read `CLAUDE.md`, `docs/tab-layout-standard.md`, and the reference bottom-sheet modal at `app/trip/[id]/group/bulk-invite-modal.tsx` before writing any code. Mockup reference: `mockups/group-member-detail-modal-mockup.html`.

---

## The bug this fixes
On `/trip/[id]/group`, when the host taps a non-host chip in the crew roster (Row 2 of the sticky top region), the person is **silently deleted from the trip** with no confirmation. See `app/trip/[id]/group/group-page.tsx` lines 436–445:

```tsx
const handleChipClick = () => {
  if (isMe) { router.push(`/trip/${trip.id}/role?...`); return; }
  if (isHost && !isHostChip) removeMember(m.id);   // ← destructive, no confirm
};
```

One stray tap on a phone permanently removes a friend or family member from the trip (and all their `event_participants`, `packing_items`, `packing_outfits` via cascade). That is the behavior we are replacing.

---

## What this phase builds (and ONLY this)

Two changes:

1. **New file**: `app/trip/[id]/group/member-detail-modal.tsx` — a bottom-sheet modal that renders a single member's details and handles remove-with-confirmation.
2. **Small edit** to `app/trip/[id]/group/group-page.tsx` — replace the destructive `removeMember(m.id)` branch in `handleChipClick` with `setOpenMember(m)`, and render `<MemberDetailModal ... />` when `openMember` is set.

That is the entire scope. No schema changes. No new tables. No changes to `page.tsx` (server). No changes to other tabs. No restyle of the chip row itself — the chip row's JSX and layout stay byte-for-byte identical.

---

## Finalized design decisions — do NOT re-ask

### File location and naming
- New file: `app/trip/[id]/group/member-detail-modal.tsx`. Matches the sibling pattern of `bulk-invite-modal.tsx` in the same folder.
- Default export: `export default function MemberDetailModal(...)`.
- Props interface is named `MemberDetailModalProps` and is exported (same convention as `BulkInviteModalProps`).

### Props API
```tsx
import type { TripMember } from "@/types/database.types";
import type { ThemeConfig } from "@/lib/constants";

export interface MemberDetailModalProps {
  member: TripMember;            // the chip that was tapped — never null (parent only renders when set)
  theme: ThemeConfig;             // th from the trip-type theme
  isHost: boolean;                // current viewer — gates the Remove action
  onClose: () => void;
  onRemove: (memberId: string) => Promise<void> | void;  // parent's existing removeMember
}
```

No `roleLabel` prop, no `avatarUrl` prop — everything derives from `member` + `theme`. Keep the surface minimal.

### Modal structure — follow `project_modal_pattern.md` exactly
Copy the skeleton from `bulk-invite-modal.tsx` lines 212–239 and 240–286 (backdrop, sheet, sticky header). Same values, no new styling invented:
- Backdrop: `position: fixed; inset: 0; zIndex: 1000; background: rgba(0,0,0,0.45); display: flex; alignItems: flex-end; justifyContent: center; animation: fadeIn 0.15s ease-out`
- Sheet: `width: 100%; maxWidth: 480; maxHeight: 90vh; borderRadius: "20px 20px 0 0"; boxShadow: "0 -8px 40px rgba(0,0,0,0.2)"; background: th.bg; animation: slideUp 0.2s ease-out`
- Sticky header with Outfit 800/18px title and ✕ close button (`background: none; fontSize: 22; color: th.muted`)
- Scrollable body: `overflowY: auto; padding: "20px 20px 20px"; flex: 1`
- Sticky footer: `position: sticky; bottom: 0; background: th.bg; padding: "12px 20px 14px"; borderTop: 1px solid th.cardBorder; boxShadow: "0 -4px 12px rgba(0,0,0,0.04)"`
- Click on backdrop closes; `onClick={(e) => e.stopPropagation()}` on the sheet
- Keyframes `fadeIn` / `slideUp` — already defined in globals (same as bulk-invite modal), do NOT redefine

### Modal body — what to show
A profile header followed by a detail list, both in that order:

**Profile header block** (top of body):
- 64×64 circular avatar — `linear-gradient(135deg, th.accent 0%, th.accent2 || th.accent 100%)`, white first-initial at Outfit 800/26px
- `member.name` in Outfit 700/20px
- `member.email || (member.family_member_id ? "Family member (no email)" : "—")` at 12px, `th.muted`, `word-break: break-all`

**Detail list** (white card, `1px solid th.cardBorder`, `borderRadius: 12`, rows split by `1px solid th.cardBorder`, final row no border):
| Label | Value |
|---|---|
| Role | `member.role === "host" ? "Host" : "Member"` |
| Status | `<StatusChip status={member.status} />` — **reuse** the existing `StatusChip` component at `group-page.tsx` lines 14–29. Export it from `group-page.tsx` (`export const StatusChip = ...`) and import it in the modal. Do NOT copy-paste the component. |
| Role preference | `ROLE_PREFERENCES.find(r => r.value === member.role_preference)` → `"{icon} {label}"`, or `"Not set"` |
| Added | `new Date(member.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })` |

Labels in `th.muted` at 13px/500; values at 13px/600, right-aligned.

### Remove action — two-step confirmation
Internal state `const [confirming, setConfirming] = useState(false);` and `const [removing, setRemoving] = useState(false);`.

**Default footer** (`confirming === false`):
```
[ Close ]   [ 🗑 Remove from trip ]
```
- "Close" — secondary button (transparent, `1.5px solid #d0d0d0`, `#555`), `onClick={onClose}`
- "Remove from trip" — danger-outline button (transparent, `1.5px solid #d9534f`, `#d9534f` text), `onClick={() => setConfirming(true)}`
- **If `member.role === "host"` OR `!isHost`, the Remove button is NOT rendered at all.** Hosts can't be removed. Non-hosts can't remove anyone.

**Confirmation state** (`confirming === true`):
Show a warning banner inside the body (above/below the detail list — pick below, same as the mockup):
```
⚠️ Remove {member.name} from this trip?
They'll lose access to the itinerary, packing, and expenses. You can re-invite them later.
```
- Banner: `padding: 14; background: "#fff3cd"; border: "1px solid #ffeaa7"; borderRadius: 12; fontSize: 13; color: "#856404"`

And swap the footer to:
```
[ Cancel ]   [ Yes, remove {member.name} ]
```
- "Cancel" — secondary, `onClick={() => setConfirming(false)}`
- "Yes, remove {member.name}" — solid danger (`background: "#d9534f"; color: "#fff"; border: none; boxShadow: "0 2px 8px rgba(217,83,79,0.3)"`). While `removing === true`, label becomes `"Removing…"` and the button is disabled.

On click:
```tsx
setRemoving(true);
await onRemove(member.id);
setRemoving(false);
onClose();
```
The parent's `onRemove` (i.e. the existing `removeMember`) already handles DB delete, local state update, and activity logging — do not duplicate any of that inside the modal.

---

## Migration — `app/trip/[id]/group/group-page.tsx`

1. Add the import near the other module imports:
   ```tsx
   import MemberDetailModal from "./member-detail-modal";
   ```
2. Export `StatusChip` so the modal can import it:
   ```tsx
   export const StatusChip = ({ status }: { status: string }) => { ... };
   ```
   (Just prepend `export` — no other change.)
3. Add state alongside the other `useState`s:
   ```tsx
   const [openMember, setOpenMember] = useState<TripMember | null>(null);
   ```
4. Edit `handleChipClick` (currently ~lines 436–444) — replace the `removeMember` branch with opening the modal. Self-chip behavior is unchanged:
   ```tsx
   const handleChipClick = () => {
     if (isMe) {
       router.push(
         `/trip/${trip.id}/role?redirectTo=${encodeURIComponent(`/trip/${trip.id}/group`)}`
       );
       return;
     }
     if (isHost && !isHostChip) setOpenMember(m);
   };
   ```
   The `chipIsInteractive` computation on line 445 stays exactly as-is (`isMe || (isHost && !isHostChip)`) — both branches still make the chip tappable.
5. Render the modal at the end of the component, just before `<TripSubNav ... />` (line 884). Mounting it outside the sticky top region keeps it independent of the top's z-index / blur:
   ```tsx
   {openMember && (
     <MemberDetailModal
       member={openMember}
       theme={th}
       isHost={isHost}
       onClose={() => setOpenMember(null)}
       onRemove={removeMember}
     />
   )}
   ```
6. Do NOT change `removeMember` itself. It already does the delete + state update + activity log correctly.

---

## What does NOT change
- No schema, RLS policy, or migration.
- No change to `page.tsx` (server) — data fetching is untouched.
- No change to the chip row's layout, styling, status colors, `StatusChip` palette, roster ordering, or `orderedMembers` logic.
- No change to the friends/families list body, the invite form, the bulk invite modal, or `TripSubNav`.
- No change to the `removeMember` function — the modal calls it verbatim.
- No new constants in `lib/constants.ts`.
- No new types in `types/database.types.ts`.

---

## Verification checklist (run before declaring done)
- [ ] `app/trip/[id]/group/member-detail-modal.tsx` exists, default-exports `MemberDetailModal`, exports `MemberDetailModalProps`.
- [ ] `StatusChip` is exported from `group-page.tsx` and imported by the modal (no duplicate component).
- [ ] Host tapping a non-host chip opens the modal — **no chip disappears on tap**. This is the primary regression to check.
- [ ] Host tapping their own chip still routes to `/trip/[id]/role?redirectTo=...` (self behavior unchanged).
- [ ] Non-host viewing the group tab: tapping any other chip does nothing (the modal does not open, `chipIsInteractive` already enforces this via cursor — confirm click handler short-circuits too).
- [ ] Modal header shows the member's name. Close (✕) and backdrop click both close the modal with no removal.
- [ ] Remove button is hidden for the host chip. Remove button is hidden when `isHost === false`.
- [ ] Clicking "Remove from trip" swaps the footer to Cancel / "Yes, remove {name}" and shows the yellow warning banner. Cancel restores the default footer and hides the banner, no DB call made.
- [ ] "Yes, remove {name}" calls `removeMember(member.id)`, shows "Removing…" while pending, closes the modal, and the chip disappears from the roster. `trip_activity` row is written (existing logActivity path).
- [ ] Email / family / external-invite variants all render correctly:
  - App user member: shows email
  - Family-linked member (`family_member_id` set, `user_id` null): shows "Family member (no email)"
  - External invite (no `user_id`, no `family_member_id`, has email): shows email, status `pending`
- [ ] Status chip in the detail row matches the chip-row status color mapping. Role preference row falls back to "Not set" when null.
- [ ] Modal structure matches `bulk-invite-modal.tsx` exactly — same backdrop, same sheet radius, same slideUp/fadeIn. Open both modals side by side to eyeball.
- [ ] `npm run build` passes with no new TypeScript errors, no new ESLint warnings.
- [ ] Diff is clean — only two files changed: `group-page.tsx` and the new `member-detail-modal.tsx`.

---

## When done
Push straight to `main` (solo hobby project — no PR). Commit message:

```
group: replace destructive chip-tap with member detail modal

Tapping a crew chip on /trip/[id]/group used to silently call
removeMember(m.id), nuking the person from the trip (and cascading
through event_participants / packing_items / packing_outfits). One
stray tap on a phone was enough to wipe a friend off the trip.

Replace the tap handler with a bottom-sheet modal that shows the
member's name, role, status, role preference, and add date. Remove
is now a two-step confirm (yellow warning banner + "Yes, remove
{name}" red button). Host chip hides the Remove action; non-host
viewers can't open the modal at all (existing chipIsInteractive gate).

- New: app/trip/[id]/group/member-detail-modal.tsx (follows the
  project_modal_pattern.md bottom-sheet skeleton, mirrors
  bulk-invite-modal.tsx)
- group-page.tsx: export StatusChip, add openMember state, swap
  destructive branch in handleChipClick for setOpenMember, render
  the modal before TripSubNav
- removeMember itself unchanged — modal calls it verbatim
```

I (Claude) cannot run git from the sandbox — run the commit + push locally.
