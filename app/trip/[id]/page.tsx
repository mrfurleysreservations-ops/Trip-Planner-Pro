import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Trip,
  TripBooking,
  TripMember,
  ItineraryEvent,
  TripExpense,
  ExpensePayer,
  ExpenseSplit,
  FamilyMember,
  TripMessage,
} from "@/types/database.types";
import { defaultTabForRole } from "@/lib/role-density";
import { buildFamilyGroups } from "@/lib/family-groups";
import { computeViewerBalance } from "@/lib/expense-balance";
import { fetchUnreadChatState } from "@/lib/chat-unread";
import type { ExpenseWithRelations } from "./expenses/page";
import TripPage, { type RoleHeroData } from "./trip-page";

export default async function TripServerPage({ params, searchParams }: { params: { id: string }; searchParams: { edit?: string; from?: string } }) {
  const supabase = createServerSupabaseClient();
  const { id } = params;
  const wantsEdit = searchParams.edit === "true";
  const fromGroup = searchParams.from === "group";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Batch 1: everything we can fetch against the trip id directly, plus the
  // viewer's chat-unread state (which only needs trip_id + user.id). This is
  // the biggest parallel window — the rest of the page waits on members or
  // expense ids to resolve before the second batch can run.
  const [
    tripRes,
    membersRes,
    bookingsRes,
    eventsRes,
    latestMessageRes,
    expensesRes,
    unreadState,
  ] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).single(),
    supabase.from("trip_members").select("*").eq("trip_id", id),
    supabase.from("trip_bookings").select("*").eq("trip_id", id).order("start_date", { ascending: true }),
    // Itinerary events feed the role hero (next-event card, upcoming count).
    // Ordered so the first event with a future-or-today date lands at index 0
    // after we filter below.
    supabase
      .from("itinerary_events")
      .select("*")
      .eq("trip_id", id)
      .not("date", "is", null)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    // Latest non-deleted chat message — drives the hero "💬 Latest" snippet.
    // Single-row fetch keeps the payload trivial even on noisy trips.
    supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    // Reuse the same server path the client hook uses — keeps the hub hero
    // unread count and the sub-nav badge count in lockstep on every render.
    fetchUnreadChatState(supabase, id, user.id),
  ]);

  const trip = tripRes.data as Trip | null;
  if (!trip) redirect("/dashboard");

  const members = (membersRes.data ?? []) as TripMember[];
  const bookings = bookingsRes.data ?? [];
  const events = (eventsRes.data ?? []) as ItineraryEvent[];
  const allExpenses = (expensesRes.data ?? []) as TripExpense[];

  const isHost = trip.owner_id === user.id;
  const memberCount = members.length;
  const currentMember = members.find((m) => m.user_id === user.id) ?? null;
  const userName = currentMember?.name || "Someone";
  const currentUserRole: string | null = currentMember?.role_preference ?? null;

  // Determine if the trip setup is complete
  // A trip is "set up" when it has a real name, location, and at least one date
  const isSetupComplete =
    trip.name !== "New Trip" &&
    !!trip.location &&
    (!!trip.start_date || !!trip.end_date);

  // Guests always go to the hub; hosts go to setup if incomplete
  // Also allow hosts to force-edit via ?edit=true query param
  // If user just came from the group page, skip setup and show the hub
  const needsSetup = isHost && !fromGroup && (!isSetupComplete || wantsEdit);

  // Role-driven default tab redirect. Only fires on the bare /trip/[id] hub
  // entry (this file). Specific sub-paths /trip/[id]/itinerary, /expenses,
  // etc. resolve through their own server components and are unaffected.
  //
  // Rules:
  //   - Skip when `needsSetup` (host still needs to fill in trip details).
  //   - Skip when the user came from the group page (post-invite handoff).
  //   - Skip when the role's default tab is `itinerary` (hub already shows
  //     that view inline — no redirect needed; also keeps unknown/null roles
  //     from bouncing, since getRoleConfig falls back to `helping_out`).
  //   - Skip for `just_here` — the hub hero shows them the expense summary
  //     they came for, so we no longer bounce them through /expenses. Other
  //     non-itinerary roles still redirect (future-proofing for new roles
  //     with a different default landing).
  //   - Otherwise redirect to /trip/[id]/<defaultTab>.
  if (!needsSetup && currentMember) {
    const defaultTab = defaultTabForRole(currentUserRole);
    if (defaultTab && defaultTab !== "itinerary" && currentUserRole !== "just_here") {
      redirect(`/trip/${id}/${defaultTab}`);
    }
  }

  // Compute "next event" + upcoming counts server-side so the hero doesn't
  // need to re-filter on the client. "Today" uses the trip viewer's local
  // date via the server's ISO slice — good enough for a single-day window
  // (events are stored as plain DATE, no timezone). If your trip spans
  // different timezones, the hero might be off by a day at the edges.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEventsAll = events.filter((e) => !!e.date && e.date >= todayIso);
  const nextEvent: ItineraryEvent | null = upcomingEventsAll[0] ?? null;
  // Hub hero's Quick-scan shows up to 3 upcoming events. Past ones are
  // intentionally excluded — this is a "what's next" surface, not history.
  const upcomingEventsTop3 = upcomingEventsAll.slice(0, 3);

  // ─── Batch 2 — everything that needs resolved ids from batch 1 ───
  //
  // Depends on: `members` (family_member_ids), `allExpenses` (expense ids),
  // `currentMember` (packing filter). Running these in parallel with each
  // other is fine; they're independent of one another.
  const familyMemberIds = members
    .map((m) => m.family_member_id)
    .filter(Boolean) as string[];
  const expenseIds = allExpenses.map((e) => e.id);

  const [payersRes, splitsRes, familyMembersRes, packingItemsRes] = await Promise.all([
    expenseIds.length > 0
      ? supabase.from("expense_payers").select("*").in("expense_id", expenseIds)
      : Promise.resolve({ data: [] as ExpensePayer[] }),
    expenseIds.length > 0
      ? supabase.from("expense_splits").select("*").in("expense_id", expenseIds)
      : Promise.resolve({ data: [] as ExpenseSplit[] }),
    familyMemberIds.length > 0
      ? supabase.from("family_members").select("*").in("id", familyMemberIds)
      : Promise.resolve({ data: [] as FamilyMember[] }),
    currentMember
      ? supabase
          .from("packing_items")
          .select("id, is_packed")
          .eq("trip_id", id)
          .eq("trip_member_id", currentMember.id)
      : Promise.resolve({ data: [] as { id: string; is_packed: boolean }[] }),
  ]);

  const allPayers = (payersRes.data ?? []) as ExpensePayer[];
  const allSplits = (splitsRes.data ?? []) as ExpenseSplit[];
  const familyMembersData = (familyMembersRes.data ?? []) as FamilyMember[];
  const packingItems = (packingItemsRes.data ?? []) as { id: string; is_packed: boolean }[];

  const expensesWithRelations: ExpenseWithRelations[] = allExpenses.map((e) => ({
    ...e,
    payers: allPayers.filter((p) => p.expense_id === e.id),
    splits: allSplits.filter((s) => s.expense_id === e.id),
  }));

  const familyGroups = buildFamilyGroups(members, familyMembersData);

  // Viewer balance — if the viewer isn't a trip_member row yet (host viewing
  // before accepting), pass an empty string so computeViewerBalance lands on
  // the "no matching family" path and returns a zeroed-out ViewerBalance.
  const viewerBalance = computeViewerBalance(
    expensesWithRelations,
    familyGroups,
    members,
    currentMember?.id ?? "",
  );

  // Resolve the latest message author to a display name. Prefer the
  // trip_members row (matches how the chat page displays messages); fall back
  // to a generic label for orphaned rows (e.g. a removed member's old send).
  const latestMessage = (latestMessageRes.data as TripMessage | null) ?? null;
  let latestMessageForHero: RoleHeroData["latestMessage"] = null;
  if (latestMessage) {
    const authorMember = members.find((m) => m.user_id === latestMessage.sender_id);
    latestMessageForHero = {
      authorName: authorMember?.name || "Someone",
      body: latestMessage.content,
      createdAt: latestMessage.created_at,
    };
  }

  const packingTotal = packingItems.length;
  const packingPacked = packingItems.filter((p) => p.is_packed).length;

  const heroData: RoleHeroData = {
    viewerNet: viewerBalance.net,
    counterpartyName: viewerBalance.counterpartyName,
    topOwedExpenseTitles: viewerBalance.topOwedExpenseTitles,
    tripUnsettledTotal: viewerBalance.tripUnsettledTotal,
    unreadChatCount: unreadState.count,
    chatLevel: unreadState.level,
    latestMessage: latestMessageForHero,
    packingTotal,
    packingPacked,
  };

  return (
    <TripPage
      trip={trip}
      userId={user.id}
      userName={userName}
      isHost={isHost}
      needsSetup={needsSetup}
      memberCount={memberCount}
      bookings={bookings as TripBooking[]}
      members={members}
      currentUserRole={currentUserRole}
      nextEvent={nextEvent}
      upcomingEvents={upcomingEventsTop3}
      heroData={heroData}
    />
  );
}
