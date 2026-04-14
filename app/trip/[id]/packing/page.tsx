import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Trip, TripMember, ItineraryEvent, EventParticipant, PackingItem, PackingOutfit, OutfitPackingItem, OutfitGroup, OutfitGroupEvent, UserProfile, FamilyMember, PackingBag, PackingBagSection, PackingBagContainer, PackingItemAssignment } from "@/types/database.types";
import PackingPage from "./packing-page";

export interface PackingPageProps {
  trip: Trip;
  members: TripMember[];
  events: ItineraryEvent[];
  participants: EventParticipant[];
  packingItems: PackingItem[];
  packingOutfits: PackingOutfit[];
  outfitPackingItems: OutfitPackingItem[];
  outfitGroups: OutfitGroup[];
  outfitGroupEvents: OutfitGroupEvent[];
  userProfile: UserProfile;
  familyMembers: FamilyMember[];
  userId: string;
  isHost: boolean;
  packingBags: PackingBag[];
  packingBagSections: PackingBagSection[];
  packingBagContainers: PackingBagContainer[];
  packingItemAssignments: PackingItemAssignment[];
}

export default async function PackingServerPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) redirect("/dashboard");

  const isHost = trip.owner_id === user.id;

  // Fetch user profile (for packing preferences, clothing styles, gender)
  const { data: userProfile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();

  // Fetch user's family members (for the family-only person tabs)
  const { data: families } = await supabase.from("families").select("*").eq("owner_id", user.id);
  const familyIds = (families ?? []).map(f => f.id);
  let familyMembers: FamilyMember[] = [];
  if (familyIds.length > 0) {
    const { data } = await supabase.from("family_members").select("*").in("family_id", familyIds);
    familyMembers = (data ?? []) as FamilyMember[];
  }

  // Fetch trip members
  const { data: members } = await supabase.from("trip_members").select("*").eq("trip_id", id).order("created_at");

  // Fetch itinerary events
  const { data: events } = await supabase.from("itinerary_events").select("*").eq("trip_id", id).order("date").order("sort_order");

  // Fetch event participants
  const eventIds = (events ?? []).map(e => e.id);
  let participants: EventParticipant[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase.from("event_participants").select("*").in("event_id", eventIds);
    participants = (data ?? []) as EventParticipant[];
  }

  // Fetch packing items (RLS ensures only family-scoped items returned)
  const { data: packingItems } = await supabase.from("packing_items").select("*").eq("trip_id", id).order("sort_order");

  // Fetch packing outfits (RLS ensures only family-scoped)
  const { data: packingOutfits } = await supabase.from("packing_outfits").select("*").eq("trip_id", id);

  // Fetch outfit-packing-item junctions
  const outfitIds = (packingOutfits ?? []).map(o => o.id);
  let outfitPackingItems: OutfitPackingItem[] = [];
  if (outfitIds.length > 0) {
    const { data } = await supabase.from("outfit_packing_items").select("*").in("outfit_id", outfitIds);
    outfitPackingItems = (data ?? []) as OutfitPackingItem[];
  }

  // Fetch outfit groups and their event mappings
  const { data: outfitGroups } = await supabase.from("outfit_groups").select("*").eq("trip_id", id).order("date").order("sort_order");
  const groupIds = (outfitGroups ?? []).map(g => g.id);
  let outfitGroupEvents: OutfitGroupEvent[] = [];
  if (groupIds.length > 0) {
    const { data } = await supabase.from("outfit_group_events").select("*").in("outfit_group_id", groupIds);
    outfitGroupEvents = (data ?? []) as OutfitGroupEvent[];
  }

  // Fetch user's packing bags (persist across trips — belong to user, not trip)
  const { data: packingBags } = await supabase.from("packing_bags").select("*").eq("user_id", user.id).order("sort_order");

  // Fetch sections for the user's bags
  const bagIds = (packingBags ?? []).map(b => b.id);
  let packingBagSections: PackingBagSection[] = [];
  if (bagIds.length > 0) {
    const { data } = await supabase.from("packing_bag_sections").select("*").in("bag_id", bagIds).order("sort_order");
    packingBagSections = (data ?? []) as PackingBagSection[];
  }

  // Fetch containers for those sections
  const sectionIds = packingBagSections.map(s => s.id);
  let packingBagContainers: PackingBagContainer[] = [];
  if (sectionIds.length > 0) {
    const { data } = await supabase.from("packing_bag_containers").select("*").in("section_id", sectionIds).order("sort_order");
    packingBagContainers = (data ?? []) as PackingBagContainer[];
  }

  // Fetch item assignments for this trip
  const { data: packingItemAssignments } = await supabase.from("packing_item_assignments").select("*").eq("trip_id", id);

  return (
    <PackingPage
      trip={trip as Trip}
      members={(members ?? []) as TripMember[]}
      events={(events ?? []) as ItineraryEvent[]}
      participants={participants}
      packingItems={(packingItems ?? []) as PackingItem[]}
      packingOutfits={(packingOutfits ?? []) as PackingOutfit[]}
      outfitPackingItems={outfitPackingItems}
      outfitGroups={(outfitGroups ?? []) as OutfitGroup[]}
      outfitGroupEvents={outfitGroupEvents}
      userProfile={userProfile as UserProfile}
      familyMembers={familyMembers}
      userId={user.id}
      isHost={isHost}
      packingBags={(packingBags ?? []) as PackingBag[]}
      packingBagSections={packingBagSections}
      packingBagContainers={packingBagContainers}
      packingItemAssignments={(packingItemAssignments ?? []) as PackingItemAssignment[]}
    />
  );
}
