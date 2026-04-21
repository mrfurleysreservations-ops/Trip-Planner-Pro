// Role-density helpers — shared lookups for role-driven UI behavior.
//
// Core rule (see feedback memory `role_density_no_feature_loss.md`):
//   Role preferences only REORDER and RE-DEFAULT things. They never hide
//   features. If you find yourself gating a tab or feature behind a role,
//   stop — that's a density regression.
//
// The source of truth for per-role config lives on ROLE_PREFERENCES in
// lib/constants.ts. These helpers just resolve a role string safely (with
// a fallback to `helping_out`, the neutral middle default) and expose the
// two fields most callers actually need.

import { ROLE_PREFERENCES, type RolePreference } from "./constants";

type RoleConfig = (typeof ROLE_PREFERENCES)[number];

export function getRoleConfig(role: RolePreference | string | null | undefined): RoleConfig {
  const found = ROLE_PREFERENCES.find((r) => r.value === role);
  return found ?? ROLE_PREFERENCES.find((r) => r.value === "helping_out")!;
}

/** Ordered list of sub-nav tab segments for a given role. All 7 tabs, always. */
export function subNavOrderForRole(role: RolePreference | string | null | undefined): readonly string[] {
  return getRoleConfig(role).subNavOrder;
}

/** Which tab (segment) the user should land on when they open /trip/[id]. */
export function defaultTabForRole(role: RolePreference | string | null | undefined): string {
  return getRoleConfig(role).defaultTab;
}

/** Which tabs ride in the bottom bar (always 4). Rest go into the ⋯ More sheet. */
export function primaryTabsForRole(role: RolePreference | string | null | undefined): readonly string[] {
  return getRoleConfig(role).primaryTabs;
}

/** Tabs that live behind ⋯ More for this role — subNavOrder minus primaryTabs, order preserved. */
export function moreTabsForRole(role: RolePreference | string | null | undefined): readonly string[] {
  const cfg = getRoleConfig(role);
  // Widen to Set<string> so `.has()` accepts any subNavOrder segment. The
  // `as const` on ROLE_PREFERENCES narrows primaryTabs to a role-specific
  // literal union, but subNavOrder spans every tab across all roles.
  const primary = new Set<string>(cfg.primaryTabs);
  return cfg.subNavOrder.filter((seg) => !primary.has(seg));
}
