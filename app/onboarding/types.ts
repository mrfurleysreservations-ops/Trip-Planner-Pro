// ═══════════════════════════════════════════════════════════
//  ONBOARDING TYPES
// ═══════════════════════════════════════════════════════════

export interface OnboardingData {
  name: string;
  avatarUrl: string | null;
  gender: string | null;
  ageRange: string | null;
  phone: string;
  clothingStyles: string[];
  connections: AppUser[];
  familyMembers: FamilyEntry[];
  invitesSent: string[];
  packingStyle: string | null;
  orgMethod: string | null;
  foldingMethod: string | null;
  compartmentSystem: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  avatar_url: string | null;
  mutualFriends: number;
}

export interface FamilyEntry {
  id: string | number;
  name: string;
  age_type: string;
  icon: string;
  linkedUserId: string | null;
}

export interface InviterInfo {
  id: string;
  name: string;
  avatar: string;
  avatar_url: string | null;
}

export interface InviterFriend {
  id: string;
  name: string;
  avatar: string;
  avatar_url: string | null;
  trips: number;
}

export interface StepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  onNext?: () => void;
  onBack?: () => void;
}

export interface OnboardingPageProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  avatarUrl: string | null;
  defaultRolePreference: string | null;
  // ─── Standalone upgrade-path mode ───
  // When present in the URL as ?standalone=1&step=<name>, onboarding re-mounts a single
  // existing step so users can opt into features they skipped. /profile Upgrade cards
  // deep-link here. Existing profile values are pre-seeded so users can edit, not just
  // re-enter. See docs/role-based-onboarding.md → "Upgrade Paths".
  standalone?: boolean;
  standaloneStep?: string | null;
  onboardingCompleted?: boolean;
  initialProfileSeed?: {
    gender: string | null;
    ageRange: string | null;
    phone: string | null;
    clothingStyles: string[];
    packingPrefs: {
      packing_style: string | null;
      organization_method: string | null;
      folding_method: string | null;
      compartment_system: string | null;
    };
  };
}
