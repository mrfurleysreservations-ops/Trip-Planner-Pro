"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, EVENT_TYPES, DRESS_CODES, TIME_SLOTS } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import type { ItineraryEvent, EventParticipant } from "@/types/database.types";
import type { ItineraryPageProps } from "./page";
import { usePlacesAutocomplete } from "@/lib/use-places-autocomplete";
import TripSubNav from "../trip-sub-nav";
import { useTripData } from "../trip-data-context";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// ─── Helpers ───

const TIME_SLOT_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

function getEventTypeConfig(val: string) {
  return EVENT_TYPES.find((t) => t.value === val) || { value: val, label: val, icon: "📌" };
}

function getDressCodeLabel(val: string | null) {
  if (!val) return null;
  return DRESS_CODES.find((d) => d.value === val)?.label || val;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Derive time slot from a time string like "14:30" → "afternoon" */
function timeToSlot(time: string): string {
  if (!time) return "morning";
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const cur = new Date(s);
  while (cur <= e) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Sub-components ───

function DressCodeBadge({ code, accent }: { code: string; accent: string }) {
  const label = getDressCodeLabel(code);
  if (!label) return null;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
      background: `${accent}18`, color: accent,
    }}>
      {label}
    </span>
  );
}

function RequiredBadge() {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
      background: "#fce4ec", color: "#c62828",
    }}>
      Required
    </span>
  );
}

function OptionalBadge() {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
      background: "#e8f5e9", color: "#2e7d32",
    }}>
      Optional
    </span>
  );
}

// ─── Main component ───

export default function ItineraryPage({
  participants: initialParticipants,
  openEventId, fromNote, fromNoteTitle, fromNoteDescription, fromNoteLink, fromNoteDate, fromNoteStartTime, fromNoteEndTime,
  eventExpenseTotals,
}: ItineraryPageProps) {
  const { trip, members, events: initialEvents, userId, isHost } = useTripData();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [events, setEvents] = useState<ItineraryEvent[]>(initialEvents);
  const [participants, setParticipants] = useState<EventParticipant[]>(initialParticipants);
  const [loading, setLoading] = useState(false);

  // Expanded event detail
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collapsed day sections (all expanded by default)
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // Add event form state
  const [addFormSlot, setAddFormSlot] = useState<{ date: string; timeSlot: string } | null>(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [addDate, setAddDate] = useState<string>("");
  const [addTimeSlot, setAddTimeSlot] = useState<string>("morning");
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addEventType, setAddEventType] = useState("activity");
  const [addDressCode, setAddDressCode] = useState("");
  const [addReservation, setAddReservation] = useState("");
  const [addConfirmation, setAddConfirmation] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addLink, setAddLink] = useState("");
  const [showAddMoreDetails, setShowAddMoreDetails] = useState(false);
  const [addIsOptional, setAddIsOptional] = useState(false);
  const [addStartTime, setAddStartTime] = useState("");
  const [addEndTime, setAddEndTime] = useState("");

  // Edit event form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editEventType, setEditEventType] = useState("activity");
  const [editDressCode, setEditDressCode] = useState("");
  const [editReservation, setEditReservation] = useState("");
  const [editConfirmation, setEditConfirmation] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editIsOptional, setEditIsOptional] = useState(false);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // View mode toggle (calendar vs list)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importFileName, setImportFileName] = useState("");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Staging area state
  const [stagingCollapsed, setStagingCollapsed] = useState(false);
  const [stagingFlash, setStagingFlash] = useState(false);

  // Edit date field (needed to place staged events)
  const [editDate, setEditDate] = useState("");

  // Google Places autocomplete for location inputs (establishment = restaurants, parks, etc.)
  const addLocationRef = usePlacesAutocomplete(
    (place) => setAddLocation(place),
    {},
  );
  const editLocationRef = usePlacesAutocomplete(
    (place) => setEditLocation(place),
    {},
  );

  // ─── Derived data ───

  const acceptedMembers = useMemo(() => members.filter((m) => m.status === "accepted"), [members]);
  const totalAccepted = acceptedMembers.length;

  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => { map[m.id] = m.name; });
    return map;
  }, [members]);

  // Current user's trip_member record
  const currentMember = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId]
  );
  const currentUserName = currentMember?.name || "Someone";

  // Participants grouped by event_id
  const participantsByEvent = useMemo(() => {
    const map: Record<string, EventParticipant[]> = {};
    participants.forEach((p) => {
      if (!map[p.event_id]) map[p.event_id] = [];
      map[p.event_id].push(p);
    });
    return map;
  }, [participants]);

  // Generate day list from trip dates
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return [];
    return getDaysBetween(trip.start_date, trip.end_date);
  }, [trip.start_date, trip.end_date]);

  // Separate placed vs unplaced events
  const placedEvents = useMemo(() => events.filter((e) => e.date), [events]);
  const unplacedEvents = useMemo(() => events.filter((e) => !e.date), [events]);

  // Events grouped by date → time_slot (only placed events)
  const eventsByDaySlot = useMemo(() => {
    const map: Record<string, Record<string, ItineraryEvent[]>> = {};
    placedEvents.forEach((e) => {
      const d = e.date!;
      if (!map[d]) map[d] = {};
      if (!map[d][e.time_slot]) map[d][e.time_slot] = [];
      map[d][e.time_slot].push(e);
    });
    // Sort events within each slot by sort_order
    for (const d of Object.keys(map)) {
      for (const s of Object.keys(map[d])) {
        map[d][s].sort((a, b) => a.sort_order - b.sort_order);
      }
    }
    return map;
  }, [placedEvents]);

  // ─── Actions ───

  const resetAddForm = useCallback(() => {
    setAddFormSlot(null);
    setShowAddEventModal(false);
    setAddDate("");
    setAddTimeSlot("morning");
    setAddTitle("");
    setAddDescription("");
    setAddLocation("");
    setAddEventType("activity");
    setAddDressCode("");
    setAddReservation("");
    setAddConfirmation("");
    setAddCost("");
    setAddLink("");
    setAddIsOptional(false);
    setAddStartTime("");
    setAddEndTime("");
    setShowAddMoreDetails(false);
  }, []);

  // ─── Handle deep-link from notes "Convert to Event" flow ───
  useEffect(() => {
    if (!fromNote) return;
    const targetDate = fromNoteDate || tripDays[0] || "";
    if (!targetDate) return;
    const startTime = fromNoteStartTime || "09:00";
    const endTime = fromNoteEndTime || "10:00";

    const dayIdx = tripDays.indexOf(targetDate);
    if (dayIdx >= 0) setSelectedDayIdx(dayIdx);

    setAddDate(targetDate);
    setAddTimeSlot(timeToSlot(startTime));
    setShowAddEventModal(true);
    setAddTitle(fromNoteTitle || "");
    setAddDescription(fromNoteDescription || "");
    setAddLink(fromNoteLink || "");
    setAddStartTime(startTime);
    setAddEndTime(endTime);
  }, [fromNote]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handle deep-link from activity log — open event modal + switch to correct day ───
  useEffect(() => {
    if (!openEventId) return;
    // Look up the event's date from the events array to auto-switch day
    const targetEvent = events.find((e) => e.id === openEventId);
    if (targetEvent && targetEvent.date) {
      const dayIdx = tripDays.indexOf(targetEvent.date);
      if (dayIdx >= 0) setSelectedDayIdx(dayIdx);
    }
    setExpandedId(openEventId);
  }, [openEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addEvent = useCallback(async () => {
    if (!addDate || !addTitle.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("itinerary_events")
      .insert({
        trip_id: trip.id,
        created_by: userId,
        date: addDate,
        time_slot: addStartTime ? timeToSlot(addStartTime) : addTimeSlot,
        start_time: addStartTime || null,
        end_time: addEndTime || null,
        title: addTitle.trim(),
        description: addDescription.trim() || null,
        location: addLocation.trim() || null,
        event_type: addEventType,
        dress_code: addDressCode || null,
        reservation_number: addReservation.trim() || null,
        confirmation_code: addConfirmation.trim() || null,
        cost_per_person: addCost ? parseFloat(addCost) : null,
        external_link: addLink.trim() || null,
        is_optional: addIsOptional,
        sort_order: 0,
      })
      .select()
      .single();
    if (error) {
      console.error("addEvent error:", JSON.stringify(error, null, 2));
    } else if (data) {
      const newEvent = data as ItineraryEvent;
      setEvents((prev) => [...prev, newEvent]);
      // The DB trigger auto-creates participants — fetch them
      const { data: newParts } = await supabase
        .from("event_participants")
        .select("*")
        .eq("event_id", newEvent.id);
      if (newParts) {
        setParticipants((prev) => [...prev, ...(newParts as EventParticipant[])]);
      }
      logActivity(supabase, {
        tripId: trip.id, userId, userName: currentUserName,
        action: "created", entityType: "itinerary_event",
        entityName: addTitle.trim(), entityId: newEvent.id,
        linkPath: `/trip/${trip.id}/itinerary?event=${newEvent.id}${newEvent.date ? `&date=${newEvent.date}` : ""}`,
      });
      resetAddForm();
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, addDate, addTimeSlot, addTitle, addDescription, addLocation, addEventType, addDressCode, addReservation, addConfirmation, addCost, addLink, addIsOptional, addStartTime, addEndTime, resetAddForm]);

  const startEdit = useCallback((e: ItineraryEvent) => {
    setEditingId(e.id);
    setEditTitle(e.title);
    setEditDescription(e.description || "");
    setEditLocation(e.location || "");
    setEditEventType(e.event_type);
    setEditDressCode(e.dress_code || "");
    setEditReservation(e.reservation_number || "");
    setEditConfirmation(e.confirmation_code || "");
    setEditCost(e.cost_per_person != null ? String(e.cost_per_person) : "");
    setEditLink(e.external_link || "");
    setEditIsOptional(e.is_optional);
    setEditStartTime(e.start_time || "");
    setEditEndTime(e.end_time || "");
    setEditDate(e.date || "");
    setExpandedId(e.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    setLoading(true);
    const wasUnplaced = !events.find((x) => x.id === editingId)?.date;
    const newDate = editDate || null;
    const validDressCode = editDressCode && DRESS_CODES.find((d) => d.value === editDressCode) ? editDressCode : null;
    const validEventType = EVENT_TYPES.find((t) => t.value === editEventType) ? editEventType : "activity";
    const { error } = await supabase
      .from("itinerary_events")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        location: editLocation.trim() || null,
        event_type: validEventType,
        dress_code: validDressCode,
        reservation_number: editReservation.trim() || null,
        confirmation_code: editConfirmation.trim() || null,
        cost_per_person: editCost ? parseFloat(editCost) : null,
        external_link: editLink.trim() || null,
        is_optional: editIsOptional,
        start_time: editStartTime || null,
        end_time: editEndTime || null,
        date: newDate,
        time_slot: editStartTime ? timeToSlot(editStartTime) : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);
    if (error) {
      console.error("saveEdit error:", JSON.stringify(error, null, 2));
      alert("Failed to save: " + error.message);
      setLoading(false);
      return;
    } else {
      const newSlot = editStartTime ? timeToSlot(editStartTime) : undefined;
      setEvents((prev) => prev.map((ev) =>
        ev.id === editingId
          ? {
              ...ev,
              title: editTitle.trim(),
              description: editDescription.trim() || null,
              location: editLocation.trim() || null,
              event_type: validEventType,
              dress_code: validDressCode,
              reservation_number: editReservation.trim() || null,
              confirmation_code: editConfirmation.trim() || null,
              cost_per_person: editCost ? parseFloat(editCost) : null,
              external_link: editLink.trim() || null,
              is_optional: editIsOptional,
              start_time: editStartTime || null,
              end_time: editEndTime || null,
              date: newDate,
              time_slot: newSlot || ev.time_slot,
              updated_at: new Date().toISOString(),
            }
          : ev
      ));
      // If event was just placed from staging, check if staging is now empty
      if (wasUnplaced && newDate) {
        const remainingUnplaced = events.filter((e) => !e.date && e.id !== editingId).length;
        if (remainingUnplaced === 0) {
          setStagingFlash(true);
          setTimeout(() => setStagingFlash(false), 2000);
        }
      }
      logActivity(supabase, {
        tripId: trip.id, userId, userName: currentUserName,
        action: wasUnplaced && newDate ? "placed" : "edited", entityType: "itinerary_event",
        entityName: editTitle.trim(), entityId: editingId,
        linkPath: `/trip/${trip.id}/itinerary?event=${editingId}${newDate ? `&date=${newDate}` : ""}`,
      });
      cancelEdit();
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, editingId, editTitle, editDescription, editLocation, editEventType, editDressCode, editReservation, editConfirmation, editCost, editLink, editIsOptional, editStartTime, editEndTime, editDate, cancelEdit, events]);

  const deleteEvent = useCallback(async (eventId: string) => {
    setLoading(true);
    const deletedEvent = events.find((e) => e.id === eventId);
    const { error } = await supabase.from("itinerary_events").delete().eq("id", eventId);
    if (error) {
      console.error("deleteEvent error:", JSON.stringify(error, null, 2));
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setParticipants((prev) => prev.filter((p) => p.event_id !== eventId));
      setConfirmDeleteId(null);
      setExpandedId(null);
      if (deletedEvent) {
        logActivity(supabase, {
          tripId: trip.id, userId, userName: currentUserName,
          action: "deleted", entityType: "itinerary_event",
          entityName: deletedEvent.title, entityId: eventId,
          linkPath: `/trip/${trip.id}/itinerary${deletedEvent.date ? `?date=${deletedEvent.date}` : ""}`,
        });
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, events]);

  const toggleParticipation = useCallback(async (eventId: string) => {
    if (!currentMember) return;
    const existing = participants.find(
      (p) => p.event_id === eventId && p.trip_member_id === currentMember.id
    );
    if (!existing) return;
    const newStatus = existing.status === "attending" ? "skipping" : "attending";
    setLoading(true);
    const { error } = await supabase
      .from("event_participants")
      .update({ status: newStatus })
      .eq("id", existing.id);
    if (error) {
      console.error("toggleParticipation error:", JSON.stringify(error, null, 2));
    } else {
      setParticipants((prev) =>
        prev.map((p) => (p.id === existing.id ? { ...p, status: newStatus } : p))
      );
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        logActivity(supabase, {
          tripId: trip.id, userId, userName: currentUserName,
          action: newStatus === "attending" ? "opted into" : "opted out of",
          entityType: "itinerary_event",
          entityName: ev.title, entityId: eventId,
          linkPath: `/trip/${trip.id}/itinerary?event=${eventId}${ev.date ? `&date=${ev.date}` : ""}`,
        });
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, currentMember, participants, events]);

  const canEditEvent = useCallback((ev: ItineraryEvent) => {
    return isHost || ev.created_by === userId;
  }, [isHost, userId]);

  const toggleDayCollapse = useCallback((date: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  // ─── Export to ICS ───

  const exportToICS = useCallback(() => {
    const escapeICS = (str: string): string =>
      str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

    const slugify = (str: string): string =>
      str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Trip Planner Pro//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICS(trip.name)} Itinerary`,
    ];

    const slotDefaults: Record<string, string> = { morning: "09:00", afternoon: "13:00", evening: "18:00" };

    placedEvents.forEach((ev) => {
      const dateStr = ev.date!.replace(/-/g, "");
      const startTime = ev.start_time || slotDefaults[ev.time_slot] || "09:00";
      const [sh, sm] = startTime.split(":").map(Number);
      const startFormatted = `${String(sh).padStart(2, "0")}${String(sm).padStart(2, "0")}00`;

      let endTime = ev.end_time;
      if (!endTime) {
        const endH = Math.min(sh + 1, 23);
        endTime = `${String(endH).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
      }
      const [eh, em] = endTime.split(":").map(Number);
      const endFormatted = `${String(eh).padStart(2, "0")}${String(em).padStart(2, "0")}00`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.id}@tripplannerpro`);
      lines.push(`DTSTART:${dateStr}T${startFormatted}`);
      lines.push(`DTEND:${dateStr}T${endFormatted}`);
      lines.push(`SUMMARY:${escapeICS(ev.title)}`);
      if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
      if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(trip.name)}-itinerary.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [placedEvents, trip.name]);

  /** Export to Google Calendar — downloads .ics then opens Google Calendar import page */
  const exportToGoogleCalendar = useCallback(() => {
    exportToICS();
    window.open("https://calendar.google.com/calendar/r/settings/export", "_blank");
  }, [exportToICS]);

  // ─── Import helpers ───

  const IMPORT_FIELD_OPTIONS = [
    { key: "title", label: "Title", required: true },
    { key: "date", label: "Date", required: false },
    { key: "startTime", label: "Start Time", required: false },
    { key: "endTime", label: "End Time", required: false },
    { key: "location", label: "Location", required: false },
    { key: "description", label: "Description", required: false },
    { key: "eventType", label: "Event Type", required: false },
    { key: "dressCode", label: "Dress Code", required: false },
  ] as const;

  const FIELD_KEYWORDS: Record<string, string[]> = {
    title: ["title", "name", "event", "what", "activity", "plan", "item", "agenda",
            "thing", "todo", "to do", "task", "subject", "summary", "itinerary"],
    date: ["date", "day", "when"],
    startTime: ["start", "time", "begin", "from", "depart", "departure", "pickup",
                "pick up", "check in", "checkin"],
    endTime: ["end", "until", "finish", "through", "thru", "done", "return", "drop off"],
    location: ["location", "place", "where", "venue", "address", "spot", "restaurant",
               "hotel", "site", "destination"],
    description: ["description", "details", "notes", "info", "information", "comments",
                  "memo", "remarks", "about", "context"],
    eventType: ["type", "category", "kind", "tag", "label", "event type", "activity type"],
    dressCode: ["dress", "attire", "outfit", "wear", "clothing", "dress code", "dresscode"],
  };

  const autoDetectMapping = useCallback((headers: string[]): Record<string, string> => {
    // Score each (header, field) pair, then assign greedily
    const scores: Array<{ header: string; field: string; score: number }> = [];
    headers.forEach((h) => {
      const lower = h.trim().toLowerCase();
      for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
        let bestScore = 0;
        for (const kw of keywords) {
          if (lower === kw) { bestScore = Math.max(bestScore, 3); }
          else if (lower.startsWith(kw)) { bestScore = Math.max(bestScore, 2); }
          else if (lower.includes(kw)) { bestScore = Math.max(bestScore, 1); }
        }
        if (bestScore > 0) scores.push({ header: h, field, score: bestScore });
      }
    });
    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);
    const mapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();
    const usedFields = new Set<string>();
    for (const { header, field } of scores) {
      if (usedHeaders.has(header) || usedFields.has(field)) continue;
      mapping[field] = header;
      usedHeaders.add(header);
      usedFields.add(field);
    }
    return mapping;
  }, []);

  /** Forgiving date parser — tries many formats, returns YYYY-MM-DD or null */
  const parseImportDate = useCallback((val: string): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;

    // 1. ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // 2. US: MM/DD/YYYY or M/D/YYYY
    const slashFull = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashFull) {
      return `${slashFull[3]}-${slashFull[1].padStart(2, "0")}-${slashFull[2].padStart(2, "0")}`;
    }

    // 3. US short: MM/DD or M/D — assume trip year or current year
    const slashShort = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (slashShort) {
      const year = trip.start_date ? trip.start_date.slice(0, 4) : String(new Date().getFullYear());
      return `${year}-${slashShort[1].padStart(2, "0")}-${slashShort[2].padStart(2, "0")}`;
    }

    // 5. Day-prefixed: strip leading day name like "Thursday 5/15" or "Thu May 15"
    const dayStripped = trimmed.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+/i, "");
    if (dayStripped !== trimmed) {
      const recursive = parseImportDate(dayStripped);
      if (recursive) return recursive;
    }

    // 6. Day-only: "Day 1", "Day 3"
    const dayNumMatch = trimmed.match(/^day\s+(\d+)$/i);
    if (dayNumMatch && tripDays.length > 0) {
      const idx = parseInt(dayNumMatch[1], 10) - 1;
      if (idx >= 0 && idx < tripDays.length) return tripDays[idx];
    }

    // 6b. Weekday-only: "Thursday", "Fri" — find the first matching day in trip range
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weekdayShort = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const lower = trimmed.toLowerCase();
    let targetDow = weekdayNames.indexOf(lower);
    if (targetDow < 0) targetDow = weekdayShort.indexOf(lower);
    if (targetDow >= 0 && tripDays.length > 0) {
      const match = tripDays.find((d) => new Date(d + "T12:00:00").getDay() === targetDow);
      if (match) return match;
    }

    // 4. Text: "May 15, 2025", "May 15", "15 May 2025"
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
      return d.toISOString().slice(0, 10);
    }
    // "May 15" without year
    const monthDayMatch = trimmed.match(/^([a-z]+)\s+(\d{1,2})$/i);
    if (monthDayMatch) {
      const year = trip.start_date ? trip.start_date.slice(0, 4) : String(new Date().getFullYear());
      const test = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${year}`);
      if (!isNaN(test.getTime())) return test.toISOString().slice(0, 10);
    }

    // 7. Nothing worked
    return null;
  }, [trip.start_date, tripDays]);

  /** Forgiving time parser — returns { start: HH:MM|null, end: HH:MM|null, slot: string|null } */
  const parseImportTime = useCallback((val: string): { start: string | null; end: string | null; slot: string | null } => {
    if (!val) return { start: null, end: null, slot: null };
    const trimmed = val.trim();
    if (!trimmed) return { start: null, end: null, slot: null };

    // Casual words
    const lc = trimmed.toLowerCase();
    if (lc === "noon") return { start: "12:00", end: null, slot: null };
    if (lc === "midnight") return { start: "00:00", end: null, slot: null };
    if (lc === "morning") return { start: null, end: null, slot: "morning" };
    if (lc === "afternoon") return { start: null, end: null, slot: "afternoon" };
    if (lc === "evening" || lc === "night" || lc === "late night") return { start: null, end: null, slot: "evening" };

    // Range: split on -, –, or " to "
    const rangeParts = trimmed.split(/\s*(?:–|-|to)\s*/i);
    if (rangeParts.length === 2) {
      const s = parseSingleTime(rangeParts[0]);
      const e = parseSingleTime(rangeParts[1]);
      if (s || e) return { start: s, end: e, slot: null };
    }

    // Single time
    const single = parseSingleTime(trimmed);
    return { start: single, end: null, slot: null };
  }, []);

  /** Parse a single time value into HH:MM or null */
  const parseSingleTime = (val: string): string | null => {
    const t = val.trim();
    if (!t) return null;
    // 24-hour: "14:00", "9:00"
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(":").map(Number);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }
    // 12-hour: "2:00 PM", "2:30pm", "2PM", "2 pm"
    const ampmMatch = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
      const isPM = ampmMatch[3].toUpperCase() === "PM";
      if (h === 12) h = isPM ? 12 : 0;
      else if (isPM) h += 12;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }
    return null;
  };

  const handleImportFile = useCallback((file: File) => {
    setImportError("");
    setImportFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            setImportError("Failed to parse CSV: " + results.errors[0].message);
            return;
          }
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, string>[];
          setImportHeaders(headers);
          setImportRows(rows);
          setImportMapping(autoDetectMapping(headers));
          setImportStep(2);
        },
        error: (err: Error) => {
          setImportError("Failed to parse CSV: " + err.message);
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
          if (json.length === 0) {
            setImportError("The spreadsheet appears to be empty.");
            return;
          }
          const headers = Object.keys(json[0]);
          setImportHeaders(headers);
          setImportRows(json.map((row) => {
            const clean: Record<string, string> = {};
            headers.forEach((h) => { clean[h] = String(row[h] ?? ""); });
            return clean;
          }));
          setImportMapping(autoDetectMapping(headers));
          setImportStep(2);
        } catch (err) {
          setImportError("Failed to parse spreadsheet: " + (err instanceof Error ? err.message : String(err)));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setImportError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
    }
  }, [autoDetectMapping]);

  const resetImport = useCallback(() => {
    setShowImportModal(false);
    setImportStep(1);
    setImportFileName("");
    setImportHeaders([]);
    setImportRows([]);
    setImportMapping({});
    setImportError("");
    setImportSuccess("");
    setImportLoading(false);
  }, []);

  type ParsedImportEvent = {
    date: string | null;
    start_time: string | null;
    end_time: string | null;
    time_slot: string;
    title: string;
    location: string | null;
    description: string | null;
    event_type: string;
    dress_code: string | null;
  };

  /** Build parsed events from import rows + mapping. Every row with a title becomes an event. */
  const buildImportPreview = useMemo(() => {
    const ready: ParsedImportEvent[] = [];
    const staging: ParsedImportEvent[] = [];

    importRows.forEach((row) => {
      const title = importMapping.title ? (row[importMapping.title] || "").trim() : "";
      if (!title) return; // Only skip rows with no title at all

      const rawDate = importMapping.date ? (row[importMapping.date] || "").trim() : "";
      const parsedDate = parseImportDate(rawDate);

      // Parse time — try mapped start/end columns first, then a single combined "time" column
      let startTime: string | null = null;
      let endTime: string | null = null;
      let parsedSlot: string | null = null;

      if (importMapping.startTime) {
        const rawStart = (row[importMapping.startTime] || "").trim();
        const parsed = parseImportTime(rawStart);
        startTime = parsed.start;
        if (!endTime && parsed.end) endTime = parsed.end;
        if (parsed.slot) parsedSlot = parsed.slot;
      }
      if (importMapping.endTime) {
        const rawEnd = (row[importMapping.endTime] || "").trim();
        const parsed = parseImportTime(rawEnd);
        endTime = parsed.start || parsed.end;
      }

      const location = importMapping.location ? (row[importMapping.location] || "").trim() || null : null;
      const description = importMapping.description ? (row[importMapping.description] || "").trim() || null : null;
      const eventType = importMapping.eventType ? (row[importMapping.eventType] || "").trim().toLowerCase() : "activity";
      const rawDressCode = importMapping.dressCode ? (row[importMapping.dressCode] || "").trim().toLowerCase() || null : null;
      const validEventType = EVENT_TYPES.find((t) => t.value === eventType) ? eventType : "activity";
      // Validate dress_code against known values — unknown values become null (avoids DB CHECK constraint violation)
      const dressCode = rawDressCode && DRESS_CODES.find((d) => d.value === rawDressCode) ? rawDressCode : null;

      const timeSlot = parsedSlot || (startTime ? timeToSlot(startTime) : "morning");

      const ev: ParsedImportEvent = {
        date: parsedDate,
        start_time: startTime,
        end_time: endTime,
        time_slot: timeSlot,
        title, location, description,
        event_type: validEventType,
        dress_code: dressCode,
      };

      if (parsedDate) ready.push(ev);
      else staging.push(ev);
    });

    return { ready, staging };
  }, [importRows, importMapping, parseImportDate, parseImportTime]);

  const executeImport = useCallback(async () => {
    const { ready, staging } = buildImportPreview;
    const total = ready.length + staging.length;
    if (total === 0) return;
    setImportLoading(true);
    setImportError("");

    const toInsertRow = (ev: ParsedImportEvent) => ({
      trip_id: trip.id,
      created_by: userId,
      date: ev.date,
      time_slot: ev.time_slot,
      start_time: ev.start_time,
      end_time: ev.end_time,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      event_type: ev.event_type,
      dress_code: ev.dress_code,
      is_optional: false,
      sort_order: 0,
    });

    let allNewEvents: ItineraryEvent[] = [];
    let stagingFailed = false;

    // Batch 1: Insert placed events (always have a date — safe even without the ALTER TABLE migration)
    if (ready.length > 0) {
      const { data, error } = await supabase
        .from("itinerary_events")
        .insert(ready.map(toInsertRow))
        .select();
      if (error) {
        setImportError("Import failed: " + error.message);
        setImportLoading(false);
        return;
      }
      allNewEvents = [...allNewEvents, ...(data || []) as ItineraryEvent[]];
    }

    // Batch 2: Insert staging events (date = null — requires the ALTER TABLE migration)
    if (staging.length > 0) {
      const { data, error } = await supabase
        .from("itinerary_events")
        .insert(staging.map(toInsertRow))
        .select();
      if (error) {
        // If the nullable migration hasn't been run, this batch fails.
        // The placed events still succeeded above — tell the user.
        console.error("Staging insert failed (date nullable migration may not have been run):", error.message);
        stagingFailed = true;
      } else {
        allNewEvents = [...allNewEvents, ...(data || []) as ItineraryEvent[]];
      }
    }

    setEvents((prev) => [...prev, ...allNewEvents]);

    // Fetch auto-created participants for all new events
    if (allNewEvents.length > 0) {
      const { data: newParts } = await supabase
        .from("event_participants")
        .select("*")
        .in("event_id", allNewEvents.map((e) => e.id));
      if (newParts) {
        setParticipants((prev) => [...prev, ...(newParts as EventParticipant[])]);
      }
    }

    const placedCount = allNewEvents.filter((e) => e.date).length;
    const stagingCount = allNewEvents.filter((e) => !e.date).length;
    logActivity(supabase, {
      tripId: trip.id, userId, userName: currentUserName,
      action: "imported", entityType: "itinerary_event",
      entityName: `${allNewEvents.length} events (${placedCount} placed, ${stagingCount} in staging)`,
      entityId: allNewEvents[0]?.id || "",
      linkPath: `/trip/${trip.id}/itinerary`,
    });

    if (stagingFailed) {
      setImportSuccess(
        `${placedCount} event${placedCount !== 1 ? "s" : ""} imported into your itinerary. ` +
        `${staging.length} events without dates couldn't be saved — run the database migration (ALTER TABLE itinerary_events ALTER COLUMN date DROP NOT NULL) to enable the staging area.`
      );
    } else {
      setImportSuccess(`${allNewEvents.length} events imported!${stagingCount > 0 ? ` ${stagingCount} need a date.` : ""}`);
    }
    setImportLoading(false);
  }, [supabase, trip.id, userId, currentUserName, buildImportPreview]);

  // ─── Form field renderer ───

  const renderFormFields = (
    prefix: "add" | "edit",
    vals: {
      title: string; description: string; location: string; eventType: string;
      dressCode: string; reservation: string; confirmation: string; cost: string;
      link: string; isOptional: boolean; startTime: string; endTime: string;
      date?: string;
    },
    setters: {
      setTitle: (v: string) => void; setDescription: (v: string) => void;
      setLocation: (v: string) => void; setEventType: (v: string) => void;
      setDressCode: (v: string) => void; setReservation: (v: string) => void;
      setConfirmation: (v: string) => void; setCost: (v: string) => void;
      setLink: (v: string) => void; setIsOptional: (v: boolean) => void;
      setStartTime: (v: string) => void; setEndTime: (v: string) => void;
      setDate?: (v: string) => void;
    },
    locationRef?: ((node: HTMLInputElement | null) => void),
    showDateField?: boolean,
  ) => (
    <>
      <input
        value={vals.title}
        onChange={(e) => setters.setTitle(e.target.value)}
        placeholder="Event title (required)"
        className="input-modern"
        style={{ marginBottom: 10 }}
        autoFocus={prefix === "add"}
      />
      {/* Date field — shown when editing staged events (no date yet) */}
      {showDateField && setters.setDate && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: !vals.date ? "#F9A825" : th.muted, display: "flex", alignItems: "center", gap: 6 }}>
            📅 Date {!vals.date && <span style={{ fontSize: 11, fontWeight: 500, color: "#F9A825" }}>(required to place this event)</span>}
            <input
              type="date"
              value={vals.date || ""}
              onChange={(e) => setters.setDate!(e.target.value)}
              className="input-modern"
              style={{
                flex: 1,
                border: !vals.date ? "2px solid #F9A825" : undefined,
                background: !vals.date ? "#FFF8E1" : undefined,
              }}
              min={trip.start_date || undefined}
              max={trip.end_date || undefined}
            />
          </label>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: th.muted, display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px" }}>
          Start
          <input
            type="time"
            value={vals.startTime}
            onChange={(e) => setters.setStartTime(e.target.value)}
            className="input-modern"
            style={{ flex: 1 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: th.muted, display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px" }}>
          End
          <input
            type="time"
            value={vals.endTime}
            onChange={(e) => setters.setEndTime(e.target.value)}
            className="input-modern"
            style={{ flex: 1 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <select
          value={vals.eventType}
          onChange={(e) => setters.setEventType(e.target.value)}
          className="input-modern"
          style={{ flex: "1 1 180px" }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
        <select
          value={vals.dressCode}
          onChange={(e) => setters.setDressCode(e.target.value)}
          className="input-modern"
          style={{ flex: "1 1 180px" }}
        >
          <option value="">No dress code</option>
          {DRESS_CODES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
      <textarea
        value={vals.description}
        onChange={(e) => setters.setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="input-modern"
        rows={2}
        style={{ marginBottom: 10, resize: "vertical", minHeight: 48 }}
      />
      <input
        ref={locationRef}
        value={vals.location}
        onChange={(e) => setters.setLocation(e.target.value)}
        placeholder="📍 Location (optional)"
        className="input-modern"
        style={{ marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={vals.reservation}
          onChange={(e) => setters.setReservation(e.target.value)}
          placeholder="Reservation #"
          className="input-modern"
          style={{ flex: "1 1 140px" }}
        />
        <input
          value={vals.confirmation}
          onChange={(e) => setters.setConfirmation(e.target.value)}
          placeholder="Confirmation code"
          className="input-modern"
          style={{ flex: "1 1 140px" }}
        />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={vals.cost}
          onChange={(e) => setters.setCost(e.target.value)}
          placeholder="Cost per person ($)"
          type="number"
          min="0"
          step="0.01"
          className="input-modern"
          style={{ flex: "1 1 140px" }}
        />
        <input
          value={vals.link}
          onChange={(e) => setters.setLink(e.target.value)}
          placeholder="Link / URL"
          className="input-modern"
          style={{ flex: "1 1 200px" }}
        />
      </div>
      <label style={{
        display: "flex", alignItems: "center", gap: 8, fontSize: 13,
        fontWeight: 600, color: th.muted, cursor: "pointer", marginBottom: 6,
      }}>
        <input
          type="checkbox"
          checked={vals.isOptional}
          onChange={(e) => setters.setIsOptional(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: th.accent }}
        />
        Optional event (members can opt out)
      </label>
    </>
  );

  // ─── Calendar grid constants ───
  const GRID_START_HOUR = 7;  // 7 AM
  const GRID_END_HOUR = 23;   // 11 PM
  const HOUR_HEIGHT = 60;     // px per hour row
  const LABEL_WIDTH = 52;     // px for the time labels column

  // Selected day for calendar view.
  // Default: first trip day. For vibes_only viewers, "Today mode" lands them
  // on today's date if the trip is currently in-progress — otherwise fall
  // back to day 1 so pre-trip and post-trip views aren't empty.
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    if (currentMember?.role_preference === "vibes_only" && tripDays.length > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const todayIdx = tripDays.indexOf(todayIso);
      if (todayIdx >= 0) return todayIdx;
    }
    return 0;
  });
  const selectedDate = tripDays[selectedDayIdx] || "";

  // Events for selected day, sorted by start_time (only placed events)
  const selectedDayEvents = useMemo(() => {
    return placedEvents
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => {
        const at = a.start_time || "00:00";
        const bt = b.start_time || "00:00";
        return at.localeCompare(bt);
      });
  }, [placedEvents, selectedDate]);

  /** Parse "HH:MM" to fractional hours (e.g., "14:30" → 14.5) */
  const parseTime = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  };

  /** Format hour number to display label */
  const formatHourLabel = (hour: number): string => {
    if (hour === 0 || hour === 24) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  /** Click on an empty hour cell → open add form with that time pre-filled */
  const handleGridClick = useCallback((hour: number) => {
    if (!selectedDate) return;
    resetAddForm();
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    const endStr = `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`;
    setAddStartTime(timeStr);
    setAddEndTime(endStr);
    setAddDate(selectedDate);
    setAddTimeSlot(timeToSlot(timeStr));
    setShowAddEventModal(true);
  }, [selectedDate, resetAddForm]);

  // ─── Render ───

  const noDates = !trip.start_date || !trip.end_date;

  /** Render an event card (used in both calendar block and expanded panel) */
  /** Render the inline add form */
  const renderAddForm = () => {
    if (!addFormSlot) return null;
    return (
      <div style={{ background: th.card, border: `1.5px solid ${th.accent}`, borderRadius: 12, padding: 16, margin: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>New Event</span>
          <button onClick={resetAddForm} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: th.muted, padding: 4 }}>✕</button>
        </div>
        {renderFormFields("add", {
          title: addTitle, description: addDescription, location: addLocation, eventType: addEventType,
          dressCode: addDressCode, reservation: addReservation, confirmation: addConfirmation, cost: addCost,
          link: addLink, isOptional: addIsOptional, startTime: addStartTime, endTime: addEndTime,
        }, {
          setTitle: setAddTitle, setDescription: setAddDescription, setLocation: setAddLocation, setEventType: setAddEventType,
          setDressCode: setAddDressCode, setReservation: setAddReservation, setConfirmation: setAddConfirmation, setCost: setAddCost,
          setLink: setAddLink, setIsOptional: setAddIsOptional, setStartTime: setAddStartTime, setEndTime: setAddEndTime,
        }, addLocationRef)}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button onClick={resetAddForm} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={addEvent} disabled={loading || !addTitle.trim()} className="btn" style={{ background: th.accent, padding: "8px 20px", fontSize: 13, fontWeight: 700, opacity: loading || !addTitle.trim() ? 0.5 : 1 }}>Save Event</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ═══ STICKY TOP REGION — header + pill + day picker ═══ */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: th.headerBg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${th.cardBorder}`,
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "8px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => router.push(`/trip/${trip.id}`)}
              aria-label="Back to trip hub"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `${th.accent}1a`,
                border: `1.5px solid ${th.accent}40`,
                color: th.accent,
                fontSize: 22,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s",
              }}
            >
              ←
            </button>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: "0 0 0 10px" }}>Itinerary</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              id="export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={placedEvents.length === 0}
              style={{
                padding: "9px 16px", borderRadius: 10,
                border: `1.5px solid ${th.accent}`, background: "none",
                cursor: placedEvents.length === 0 ? "default" : "pointer",
                fontSize: 13, fontWeight: 700, color: th.accent,
                fontFamily: "'DM Sans', sans-serif",
                opacity: placedEvents.length === 0 ? 0.4 : 1,
                whiteSpace: "nowrap",
              }}
            >
              📤 Export
            </button>
            <button
              onClick={() => { resetImport(); setShowImportModal(true); }}
              style={{
                padding: "9px 16px", borderRadius: 10,
                border: `1.5px solid ${th.accent}`, background: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700, color: th.accent,
                fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
              }}
            >
              📥 Import
            </button>
          </div>
        </div>

        {/* ═══ VIEW TOGGLE ═══ */}
        {!noDates && (
          <div style={{
            display: "flex", justifyContent: "center", padding: "12px 20px 0",
          }}>
            <div style={{
              display: "inline-flex", borderRadius: 20,
              border: `1.5px solid ${th.cardBorder}`, background: th.card,
            }}>
              {(["calendar", "list"] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "8px 18px", border: "none", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                      fontWeight: active ? 700 : 500,
                      borderRadius: 20,
                      background: active ? th.accent : "transparent",
                      color: active ? "#fff" : th.muted,
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mode === "calendar" ? "📅 Calendar" : "📋 List"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ DAY PICKER — Calendar view only ═══ */}
        {!noDates && viewMode === "calendar" && (
        <div style={{
          display: "flex", gap: 0, overflowX: "auto", WebkitOverflowScrolling: "touch",
          background: th.headerBg, borderBottom: `1px solid ${th.cardBorder}`,
          scrollbarWidth: "none", padding: "0 4px",
        }}>
          {tripDays.map((date, idx) => {
            const active = idx === selectedDayIdx;
            const d = new Date(date + "T12:00:00");
            const dayNum = idx + 1;
            const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
            const dayDate = d.getDate();
            const dayEvtCount = placedEvents.filter((e) => e.date === date).length;
            return (
              <button
                key={date}
                onClick={() => setSelectedDayIdx(idx)}
                style={{
                  flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, padding: "10px 16px", background: "none", border: "none",
                  borderBottom: `3px solid ${active ? th.accent : "transparent"}`,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                  minWidth: 56,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? th.accent : th.muted, textTransform: "uppercase" }}>
                  {dayName}
                </span>
                <span style={{ fontSize: 20, fontWeight: 800, color: active ? th.accent : th.text, fontFamily: "'Outfit', sans-serif" }}>
                  {dayDate}
                </span>
                {dayEvtCount > 0 && (
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: active ? th.accent : th.muted, opacity: active ? 1 : 0.4,
                  }} />
                )}
              </button>
            );
          })}
        </div>
        )}
      </div>

      <TripSubNav tripId={trip.id} theme={th} role={currentMember?.role_preference ?? null} />

      {/* No dates warning */}
      {noDates && (
        <div style={{ textAlign: "center", padding: 48, color: th.muted, fontSize: 14, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6, color: th.text }}>Set trip dates first</div>
          <div>Add a start and end date on the trip hub to unlock the itinerary.</div>
        </div>
      )}

      {/* ═══ STAGING AREA — Needs Attention ═══ */}
      {!noDates && unplacedEvents.length > 0 && !stagingFlash && (
        <div style={{
          position: "relative", zIndex: 1,
          margin: "0 12px", marginTop: 8,
          background: "#FFF8E1",
          border: "1px solid #FFE082",
          borderLeft: "4px solid #F9A825",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Staging header */}
          <button
            onClick={() => setStagingCollapsed(!stagingCollapsed)}
            style={{
              display: "flex", alignItems: "center", width: "100%",
              padding: "12px 16px",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span style={{ fontSize: 16, marginRight: 8 }}>📥</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: "#F57F17", flex: 1, textAlign: "left" }}>
              {unplacedEvents.length} event{unplacedEvents.length !== 1 ? "s" : ""} need attention
            </span>
            <span style={{ fontSize: 12, color: "#F9A825", transition: "transform 0.2s", transform: stagingCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
          </button>

          {/* Staging body */}
          {!stagingCollapsed && (
            <div style={{ padding: "0 16px 14px" }}>
              <div style={{ fontSize: 12, color: "#8D6E63", marginBottom: 10 }}>
                These events were imported but need a date. Tap one to place it in your itinerary.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {unplacedEvents.map((ev) => {
                  const typeConfig = getEventTypeConfig(ev.event_type);
                  return (
                    <div key={ev.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px",
                      background: "#fff", border: "1px solid #FFE082",
                      borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{typeConfig.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: th.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.title}
                        </div>
                        {ev.location && (
                          <div style={{ fontSize: 11, color: th.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            📍 {ev.location}
                          </div>
                        )}
                        {ev.description && (
                          <div style={{ fontSize: 11, color: th.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.description.slice(0, 80)}{ev.description.length > 80 ? "…" : ""}
                          </div>
                        )}
                        {/* Chips for captured data */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {ev.start_time && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#E8F5E9", color: "#2E7D32", fontWeight: 600 }}>
                              🕐 {formatTime12h(ev.start_time)}
                            </span>
                          )}
                          {ev.dress_code && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: `${th.accent}14`, color: th.accent, fontWeight: 600 }}>
                              {getDressCodeLabel(ev.dress_code)}
                            </span>
                          )}
                          {ev.event_type !== "activity" && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#E3F2FD", color: "#1565C0", fontWeight: 600 }}>
                              {typeConfig.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => { startEdit(ev); setExpandedId(null); setStagingCollapsed(true); }}
                          style={{
                            padding: "7px 14px", borderRadius: 8,
                            border: "none", background: th.accent, color: "#fff",
                            cursor: "pointer", fontSize: 12, fontWeight: 700,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Place Event
                        </button>
                        <button
                          onClick={() => deleteEvent(ev.id)}
                          disabled={loading}
                          style={{
                            padding: "7px 10px", borderRadius: 8,
                            border: "1px solid #FFCDD2", background: "none",
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                            color: "#c0392b", fontFamily: "'DM Sans', sans-serif",
                            opacity: loading ? 0.5 : 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Staging flash — "All events placed!" */}
      {stagingFlash && (
        <div style={{
          position: "relative", zIndex: 1,
          margin: "0 12px", marginTop: 8, padding: "14px 16px",
          background: "#E8F5E9", border: "1px solid #A5D6A7",
          borderRadius: 12, textAlign: "center",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
          fontSize: 14, color: "#2E7D32",
          animation: "fadeIn 0.3s ease-out",
        }}>
          ✅ All events placed!
        </div>
      )}

      {!noDates && (
        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ═══ CALENDAR TIME GRID ═══ */}
          {viewMode === "calendar" && (
          <div style={{
            maxWidth: "600px", margin: "0 auto", padding: "0 12px 20px",
            overflowY: "auto",
          }}>

            {/* Edit form — shown above grid when editing */}
            {editingId && (() => {
              const editingEvent = events.find((e) => e.id === editingId);
              if (!editingEvent || editingEvent.date !== selectedDate) return null;
              const isFromStaging = !editingEvent.date;
              return (
                <div style={{ background: th.card, border: `1.5px solid ${isFromStaging ? "#F9A825" : th.accent}`, borderRadius: 12, padding: 16, margin: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15 }}>{isFromStaging ? "Place Event" : "Editing Event"}</span>
                    <button onClick={cancelEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: th.muted, padding: 4 }}>✕</button>
                  </div>
                  {renderFormFields("edit", {
                    title: editTitle, description: editDescription, location: editLocation, eventType: editEventType,
                    dressCode: editDressCode, reservation: editReservation, confirmation: editConfirmation, cost: editCost,
                    link: editLink, isOptional: editIsOptional, startTime: editStartTime, endTime: editEndTime,
                    date: editDate,
                  }, {
                    setTitle: setEditTitle, setDescription: setEditDescription, setLocation: setEditLocation, setEventType: setEditEventType,
                    setDressCode: setEditDressCode, setReservation: setEditReservation, setConfirmation: setEditConfirmation, setCost: setEditCost,
                    setLink: setEditLink, setIsOptional: setEditIsOptional, setStartTime: setEditStartTime, setEndTime: setEditEndTime,
                    setDate: setEditDate,
                  }, editLocationRef, isFromStaging)}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                    <button onClick={cancelEdit} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={saveEdit} disabled={loading || !editTitle.trim()} className="btn" style={{ background: th.accent, padding: "8px 20px", fontSize: 13, fontWeight: 700, opacity: loading || !editTitle.trim() ? 0.5 : 1 }}>Save Changes</button>
                  </div>
                </div>
              );
            })()}

            {/* The grid */}
            <div style={{ position: "relative", marginTop: 12 }}>
              {/* Hour rows (background grid lines) */}
              {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => {
                const hour = GRID_START_HOUR + i;
                return (
                  <div
                    key={hour}
                    onClick={() => {
                      // Only open if not already adding and no event starts at this hour
                      if (!addFormSlot) handleGridClick(hour);
                    }}
                    style={{
                      display: "flex", alignItems: "flex-start", height: HOUR_HEIGHT,
                      borderBottom: `1px solid ${th.cardBorder}`,
                      cursor: addFormSlot ? "default" : "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!addFormSlot) e.currentTarget.style.background = `${th.accent}06`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Time label */}
                    <div style={{
                      width: LABEL_WIDTH, flexShrink: 0, paddingTop: 2, paddingRight: 8,
                      fontSize: 11, fontWeight: 600, color: th.muted, textAlign: "right",
                      userSelect: "none",
                    }}>
                      {formatHourLabel(hour)}
                    </div>
                    {/* Grid cell — events are positioned absolutely over this */}
                    <div style={{ flex: 1, position: "relative", borderLeft: `1px solid ${th.cardBorder}` }} />
                  </div>
                );
              })}

              {/* Event blocks — positioned absolutely over the grid */}
              {selectedDayEvents.map((ev) => {
                const startH = parseTime(ev.start_time);
                const endH = parseTime(ev.end_time);
                // If no start_time, place based on time_slot
                const slotDefaults: Record<string, number> = { morning: 9, afternoon: 13, evening: 18 };
                const effectiveStart = startH ?? (slotDefaults[ev.time_slot] || 9);
                const effectiveEnd = endH ?? effectiveStart + 1;
                const top = (effectiveStart - GRID_START_HOUR) * HOUR_HEIGHT;
                const height = Math.max((effectiveEnd - effectiveStart) * HOUR_HEIGHT, 36);
                const typeConfig = getEventTypeConfig(ev.event_type);
                const evParts = participantsByEvent[ev.id] || [];
                const attendingCount = evParts.filter((p) => p.status === "attending").length;

                return (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === ev.id ? null : ev.id);
                    }}
                    style={{
                      position: "absolute",
                      top, left: LABEL_WIDTH + 8, right: 8,
                      height,
                      minHeight: 36,
                      background: expandedId === ev.id ? `${th.accent}22` : `${th.accent}14`,
                      border: `1.5px solid ${expandedId === ev.id ? th.accent : `${th.accent}50`}`,
                      borderLeft: `4px solid ${th.accent}`,
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                      overflow: "hidden",
                      zIndex: expandedId === ev.id ? 10 : 2,
                      transition: "all 0.2s",
                      boxShadow: expandedId === ev.id ? `0 4px 20px ${th.accent}20` : "none",
                    }}
                  >
                    {/* Compact view */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{typeConfig.icon}</span>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                        {ev.title}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: th.muted, flexShrink: 0 }}>
                        👥 {attendingCount}/{totalAccepted}
                      </span>
                      {eventExpenseTotals[ev.id] ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}/expenses`); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "3px 8px", borderRadius: 999,
                            fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                            border: "none", cursor: "pointer", flexShrink: 0,
                            background: "#d4edda", color: "#155724",
                            lineHeight: 1.2,
                          }}
                        >
                          💰 ${eventExpenseTotals[ev.id].toFixed(0)}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/trip/${trip.id}/expenses?fromEvent=${ev.id}&title=${encodeURIComponent(ev.title)}&date=${ev.date || ""}`);
                          }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "3px 8px", borderRadius: 999,
                            fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                            cursor: "pointer", flexShrink: 0,
                            background: `${th.accent}14`, color: th.accent,
                            border: `1px dashed ${th.accent}59`,
                            lineHeight: 1.2,
                          }}
                        >
                          ＋ $
                        </button>
                      )}
                    </div>
                    {height > 44 && ev.location && (
                      <div style={{ fontSize: 11, color: th.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📍 {ev.location}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Empty day state */}
            {selectedDayEvents.length === 0 && !addFormSlot && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: th.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ fontWeight: 600 }}>No events on {formatDate(selectedDate)}</div>
                <div style={{ marginTop: 4 }}>Click any time slot above to add one</div>
              </div>
            )}
          </div>
          )}

          {/* ═══ LIST VIEW ═══ */}
          {viewMode === "list" && (
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "12px 12px 20px" }}>
            {tripDays.map((date, dayIdx) => {
              const dayNum = dayIdx + 1;
              const dayEvents = placedEvents
                .filter((e) => e.date === date)
                .sort((a, b) => {
                  const at = a.start_time || "99:99";
                  const bt = b.start_time || "99:99";
                  if (at !== bt) return at.localeCompare(bt);
                  return TIME_SLOT_ORDER[a.time_slot] - TIME_SLOT_ORDER[b.time_slot];
                });
              const isCollapsed = collapsedDays.has(date);

              return (
                <div key={date} style={{ marginBottom: 2 }}>
                  {/* Day header — sticky */}
                  <button
                    onClick={() => toggleDayCollapse(date)}
                    style={{
                      display: "flex", alignItems: "center", width: "100%",
                      padding: "12px 16px", background: `${th.accent}08`,
                      border: "none", borderBottom: `1px solid ${th.cardBorder}`,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      position: "sticky", top: 0, zIndex: 5,
                    }}
                  >
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: th.text, flex: 1, textAlign: "left" }}>
                      Day {dayNum} · {formatDate(date)}
                    </span>
                    <span style={{ fontSize: 12, color: th.muted, fontWeight: 600, marginRight: 10 }}>
                      {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: th.muted, transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
                  </button>

                  {/* Day content */}
                  {!isCollapsed && (
                    <div style={{ padding: "8px 0" }}>
                      {dayEvents.length === 0 && (
                        <div style={{ padding: "20px 16px", color: th.muted, fontSize: 13, fontStyle: "italic" }}>
                          No events planned
                        </div>
                      )}

                      {dayEvents.map((ev) => {
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 14,
                              padding: "18px 18px", margin: "8px 4px",
                              background: "#fff", border: `1px solid ${th.cardBorder}`,
                              borderRadius: 14, cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = th.accent; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = th.cardBorder; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; }}
                          >
                            {/* Time */}
                            <span style={{
                              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14,
                              color: th.text, minWidth: 76, flexShrink: 0, lineHeight: 1.15,
                            }}>
                              {ev.start_time ? formatTime12h(ev.start_time) : (TIME_SLOTS.find((s) => s.value === ev.time_slot)?.label || ev.time_slot)}
                            </span>
                            {/* Title */}
                            <span style={{
                              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17,
                              color: th.text, flex: 1,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              letterSpacing: "-0.01em",
                            }}>
                              {ev.title}
                            </span>
                            {/* Cash button */}
                            {eventExpenseTotals[ev.id] ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/trip/${trip.id}/expenses`); }}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "8px 14px", borderRadius: 999,
                                  fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                                  border: "none", cursor: "pointer", flexShrink: 0,
                                  minHeight: 34,
                                  background: "#d4edda", color: "#155724",
                                }}
                              >
                                💰 ${eventExpenseTotals[ev.id].toFixed(0)}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/trip/${trip.id}/expenses?fromEvent=${ev.id}&title=${encodeURIComponent(ev.title)}&date=${ev.date || ""}`);
                                }}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "8px 14px", borderRadius: 999,
                                  fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                                  cursor: "pointer", flexShrink: 0,
                                  minHeight: 34,
                                  background: `${th.accent}14`, color: th.accent,
                                  border: `1.5px dashed ${th.accent}59`,
                                }}
                              >
                                ＋ $
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* + Add Event button */}
                      <button
                        onClick={() => {
                          resetAddForm();
                          setAddDate(date);
                          setAddTimeSlot("morning");
                          setShowAddEventModal(true);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", margin: "8px 8px",
                          background: "none", border: `1.5px dashed ${th.cardBorder}`,
                          borderRadius: 10, cursor: "pointer",
                          fontSize: 13, fontWeight: 600, color: th.muted,
                          fontFamily: "'DM Sans', sans-serif",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = th.accent; e.currentTarget.style.color = th.accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = th.cardBorder; e.currentTarget.style.color = th.muted; }}
                      >
                        + Add Event
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* Spacer so the last row clears the fixed sub-nav + FAB */}
        <div style={{ height: "80px" }} />

        </div>
      )}

      {/* ═══ ADD EVENT FAB (bottom-right) ═══ */}
      <button
        onClick={() => {
          resetAddForm();
          setAddDate(tripDays[0] || "");
          setAddTimeSlot("morning");
          setShowAddEventModal(true);
        }}
        aria-label="Add event"
        style={{
          position: "fixed",
          bottom: 72,
          right: 16,
          zIndex: 50,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
          color: "#fff",
          border: "none",
          fontSize: 28,
          fontWeight: 300,
          cursor: "pointer",
          boxShadow: `0 4px 20px ${th.accent}60`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>

      {/* ═══ EVENT DETAIL MODAL ═══ */}
      {expandedId && (() => {
        const ev = events.find((e) => e.id === expandedId);
        if (!ev) return null;
        return (
          <div
            onClick={() => setExpandedId(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 560, maxHeight: "85vh",
                overflowY: "auto",
                background: th.bg, borderRadius: "20px 20px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
                padding: 0,
                animation: "slideUp 0.2s ease-out",
              }}
            >
              {/* Modal header with close */}
              <div style={{
                position: "sticky", top: 0, zIndex: 2,
                background: th.bg, padding: "16px 20px 12px",
                borderBottom: `1px solid ${th.cardBorder}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{getEventTypeConfig(ev.event_type).icon}</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18 }}>
                    {ev.title}
                  </span>
                </div>
                <button
                  onClick={() => setExpandedId(null)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 22, color: th.muted, padding: "4px 8px",
                    borderRadius: 8, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: "16px 20px 24px" }}>
                {/* Badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {ev.dress_code && <DressCodeBadge code={ev.dress_code} accent={th.accent} />}
                  {ev.is_optional ? <OptionalBadge /> : <RequiredBadge />}
                </div>

                {/* Time & Location */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, fontSize: 13 }}>
                  {ev.date && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: th.text }}>
                      <span>📅</span>
                      <span style={{ fontWeight: 600 }}>{formatDate(ev.date)}</span>
                    </div>
                  )}
                  {ev.start_time && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: th.text }}>
                      <span>🕐</span>
                      <span style={{ fontWeight: 600 }}>
                        {formatTime12h(ev.start_time)}{ev.end_time ? ` – ${formatTime12h(ev.end_time)}` : ""}
                      </span>
                    </div>
                  )}
                  {ev.location && (
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(ev.location)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8, color: th.accent, textDecoration: "none", fontWeight: 600 }}
                    >
                      <span>📍</span>
                      <span>{ev.location}</span>
                    </a>
                  )}
                </div>

                {/* Description */}
                {ev.description && (
                  <div style={{ fontSize: 14, color: th.text, lineHeight: 1.7, marginBottom: 16 }}>
                    {ev.description}
                  </div>
                )}

                {/* Detail fields grid */}
                {(ev.reservation_number || ev.confirmation_code || ev.cost_per_person != null || ev.dress_code) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 16, fontSize: 12 }}>
                    {ev.reservation_number && (
                      <div style={{ padding: "8px 12px", background: `${th.accent}08`, borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: th.muted, marginBottom: 2 }}>Reservation #</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.reservation_number}</div>
                      </div>
                    )}
                    {ev.confirmation_code && (
                      <div style={{ padding: "8px 12px", background: `${th.accent}08`, borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: th.muted, marginBottom: 2 }}>Confirmation</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.confirmation_code}</div>
                      </div>
                    )}
                    {ev.cost_per_person != null && (
                      <div style={{ padding: "8px 12px", background: `${th.accent}08`, borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: th.muted, marginBottom: 2 }}>Cost</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>${ev.cost_per_person}/person</div>
                      </div>
                    )}
                    {ev.dress_code && (
                      <div style={{ padding: "8px 12px", background: `${th.accent}08`, borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: th.muted, marginBottom: 2 }}>Dress Code</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{getDressCodeLabel(ev.dress_code)}</div>
                      </div>
                    )}
                  </div>
                )}

                {ev.external_link && (
                  <div style={{ marginBottom: 16 }}>
                    <a href={ev.external_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: th.accent, fontWeight: 600, textDecoration: "none" }}>
                      🔗 {ev.external_link.length > 50 ? ev.external_link.slice(0, 50) + "…" : ev.external_link}
                    </a>
                  </div>
                )}

                {/* Expense link */}
                <div style={{ marginBottom: 16 }}>
                  {eventExpenseTotals[ev.id] ? (
                    <button
                      onClick={() => { setExpandedId(null); router.push(`/trip/${trip.id}/expenses`); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 10,
                        background: "#d4edda", color: "#155724", border: "none",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      💰 ${eventExpenseTotals[ev.id].toFixed(2)} in expenses
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setExpandedId(null);
                        router.push(`/trip/${trip.id}/expenses?fromEvent=${ev.id}&title=${encodeURIComponent(ev.title)}&date=${ev.date || ""}`);
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 14px", borderRadius: 10,
                        background: `${th.accent}0a`, color: th.muted,
                        border: `1px dashed ${th.cardBorder}`,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      💰 Add Expense
                    </button>
                  )}
                </div>

                {/* Participants */}
                {(() => {
                  const evParts = participantsByEvent[ev.id] || [];
                  const attendingCount = evParts.filter((p) => p.status === "attending").length;
                  const myParticipant = currentMember ? evParts.find((p) => p.trip_member_id === currentMember.id) : null;
                  const amAttending = myParticipant?.status === "attending";
                  return (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10, color: th.text }}>
                          Participants ({attendingCount}/{totalAccepted} going)
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {evParts.map((p) => {
                            const name = memberNameMap[p.trip_member_id] || "Unknown";
                            const att = p.status === "attending";
                            return (
                              <span key={p.id} style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "5px 12px", borderRadius: 14, fontSize: 12, fontWeight: 600,
                                background: att ? "#e8f5e9" : "#fce4ec",
                                color: att ? "#2e7d32" : "#c62828",
                              }}>
                                {att ? "✓" : "✗"} {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Opt in/out */}
                      {ev.is_optional && myParticipant && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 16px", background: `${th.accent}08`,
                          borderRadius: 12, marginBottom: 16,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: th.text, flex: 1 }}>
                            {amAttending ? "You're going" : "You're skipping this"}
                          </span>
                          <button
                            onClick={() => toggleParticipation(ev.id)}
                            disabled={loading}
                            className="btn"
                            style={{
                              background: amAttending ? "#ef5350" : "#4caf50",
                              padding: "8px 20px", fontSize: 13, fontWeight: 700,
                              opacity: loading ? 0.5 : 1,
                            }}
                          >
                            {amAttending ? "Opt Out" : "Opt In"}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Edit / Delete — host or creator */}
                {canEditEvent(ev) && (
                  <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid ${th.cardBorder}` }}>
                    <button
                      onClick={() => { startEdit(ev); setExpandedId(null); }}
                      style={{
                        flex: 1, padding: "10px 16px", borderRadius: 10,
                        border: `1.5px solid ${th.cardBorder}`, background: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: 700,
                        color: th.text, fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Edit Event
                    </button>
                    {confirmDeleteId !== ev.id ? (
                      <button
                        onClick={() => setConfirmDeleteId(ev.id)}
                        style={{
                          padding: "10px 16px", borderRadius: 10,
                          border: `1.5px solid #ffcdd2`, background: "none",
                          cursor: "pointer", fontSize: 13, fontWeight: 700,
                          color: "#c0392b", fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Delete
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>Sure?</span>
                        <button
                          onClick={() => { deleteEvent(ev.id); setExpandedId(null); }}
                          disabled={loading}
                          style={{ padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.5 : 1 }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ ADD EVENT MODAL ═══ */}
      {showAddEventModal && (
        <div onClick={() => setShowAddEventModal(false)} style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: "fadeIn 0.15s ease-out"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: "480px",
            maxHeight: "90vh", overflowY: "auto" as const,
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
            background: th.bg,
            animation: "slideUp 0.2s ease-out"
          }}>
            {/* Sticky modal header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 1,
              padding: "18px 20px 14px",
              borderBottom: `1px solid ${th.cardBorder}`,
              background: th.bg,
              borderRadius: "20px 20px 0 0",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", margin: 0 }}>
                Add Event
              </h3>
              <button onClick={() => setShowAddEventModal(false)} style={{
                background: "none", border: "none", fontSize: "22px",
                cursor: "pointer", color: th.muted, padding: "4px"
              }}>✕</button>
            </div>

            {/* Form body — compact layout */}
            <div style={{ padding: "14px 20px 20px" }}>
              {/* Day selector pills */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Day</label>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
                  {tripDays.map((day) => {
                    const active = addDate === day;
                    return (
                      <button key={day} onClick={() => setAddDate(day)} style={{
                        padding: "6px 12px", borderRadius: 20, whiteSpace: "nowrap",
                        border: `1.5px solid ${active ? th.accent : th.cardBorder}`,
                        background: active ? `${th.accent}1a` : "transparent",
                        color: active ? th.accent : th.muted,
                        fontWeight: active ? 700 : 500, fontSize: 13,
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {formatDate(day)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Event title */}
              <input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Event title (required)"
                className="input-modern"
                style={{ marginBottom: 8 }}
                autoFocus
              />

              {/* Start & End time — single row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: th.muted, display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  Start
                  <input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="input-modern"
                    style={{ flex: 1 }}
                  />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: th.muted, display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  End
                  <input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="input-modern"
                    style={{ flex: 1 }}
                  />
                </label>
              </div>

              {/* Activity type & Dress code — single row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  value={addEventType}
                  onChange={(e) => setAddEventType(e.target.value)}
                  className="input-modern"
                  style={{ flex: 1 }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
                <select
                  value={addDressCode}
                  onChange={(e) => setAddDressCode(e.target.value)}
                  className="input-modern"
                  style={{ flex: 1 }}
                >
                  <option value="">No dress code</option>
                  {DRESS_CODES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <input
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Description (optional)"
                className="input-modern"
                style={{ marginBottom: 8 }}
              />

              {/* Location */}
              <input
                ref={addLocationRef}
                value={addLocation}
                onChange={(e) => setAddLocation(e.target.value)}
                placeholder="📍 Location (optional)"
                className="input-modern"
                style={{ marginBottom: 8 }}
              />

              {/* More Details — expandable */}
              <button
                onClick={() => setShowAddMoreDetails(!showAddMoreDetails)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: th.accent,
                  fontFamily: "'DM Sans', sans-serif", padding: "4px 0",
                  marginBottom: showAddMoreDetails ? 8 : 0,
                }}
              >
                <span style={{
                  display: "inline-block", transition: "transform 0.2s",
                  transform: showAddMoreDetails ? "rotate(90deg)" : "rotate(0deg)",
                  fontSize: 11,
                }}>▶</span>
                More Details
              </button>

              {showAddMoreDetails && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Reservation # & Confirmation code */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={addReservation}
                      onChange={(e) => setAddReservation(e.target.value)}
                      placeholder="Reservation #"
                      className="input-modern"
                      style={{ flex: 1 }}
                    />
                    <input
                      value={addConfirmation}
                      onChange={(e) => setAddConfirmation(e.target.value)}
                      placeholder="Confirmation code"
                      className="input-modern"
                      style={{ flex: 1 }}
                    />
                  </div>
                  {/* Cost & Link */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={addCost}
                      onChange={(e) => setAddCost(e.target.value)}
                      placeholder="Cost per person ($)"
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-modern"
                      style={{ flex: 1 }}
                    />
                    <input
                      value={addLink}
                      onChange={(e) => setAddLink(e.target.value)}
                      placeholder="Link / URL"
                      className="input-modern"
                      style={{ flex: 1 }}
                    />
                  </div>
                  {/* Optional checkbox */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                    fontWeight: 600, color: th.muted, cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={addIsOptional}
                      onChange={(e) => setAddIsOptional(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: th.accent }}
                    />
                    Optional event (members can opt out)
                  </label>
                </div>
              )}
            </div>

            {/* Sticky save button */}
            <div style={{
              position: "sticky", bottom: 0,
              padding: "12px 20px 20px",
              background: th.bg,
              borderTop: `1px solid ${th.cardBorder}`
            }}>
              <button
                onClick={addEvent}
                disabled={loading || !addTitle.trim() || !addDate}
                style={{
                  width: "100%", padding: "14px",
                  background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                  cursor: (loading || !addTitle.trim() || !addDate) ? "not-allowed" : "pointer",
                  opacity: (loading || !addTitle.trim() || !addDate) ? 0.5 : 1,
                }}
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXPORT MENU ═══ */}
      {showExportMenu && (
        <div
          onClick={() => setShowExportMenu(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: 56, right: 12,
              background: th.bg, borderRadius: 12,
              border: `1.5px solid ${th.cardBorder}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              overflow: "hidden", minWidth: 230,
              animation: "fadeIn 0.1s ease-out",
            }}
          >
            <button
              onClick={() => { exportToICS(); setShowExportMenu(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "14px 16px", border: "none", background: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.text,
                fontFamily: "'DM Sans', sans-serif", textAlign: "left",
                borderBottom: `1px solid ${th.cardBorder}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${th.accent}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <span style={{ fontSize: 18 }}>📄</span>
              <div>
                <div style={{ fontWeight: 700 }}>Download .ics</div>
                <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>Apple Calendar, Outlook, any app</div>
              </div>
            </button>
            <button
              onClick={() => { exportToGoogleCalendar(); setShowExportMenu(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "14px 16px", border: "none", background: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.text,
                fontFamily: "'DM Sans', sans-serif", textAlign: "left",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${th.accent}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <span style={{ fontSize: 18 }}>📅</span>
              <div>
                <div style={{ fontWeight: 700 }}>Add to Google Calendar</div>
                <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>Downloads .ics & opens import page</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ═══ PLACE EVENT MODAL — for staging events ═══ */}
      {editingId && (() => {
        const editingEvent = events.find((e) => e.id === editingId);
        if (!editingEvent || editingEvent.date) return null; // Only for unplaced events
        return (
          <div
            onClick={cancelEdit}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 560, maxHeight: "85vh",
                overflowY: "auto",
                background: th.bg, borderRadius: "20px 20px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
                padding: 0,
                animation: "slideUp 0.2s ease-out",
              }}
            >
              {/* Modal header */}
              <div style={{
                position: "sticky", top: 0, zIndex: 2,
                background: "#FFF8E1", padding: "16px 20px 12px",
                borderBottom: "1px solid #FFE082",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📥</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, color: "#F57F17" }}>
                    Place Event
                  </span>
                </div>
                <button
                  onClick={cancelEdit}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 22, color: th.muted, padding: "4px 8px",
                    borderRadius: 8, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: "16px 20px 24px" }}>
                {renderFormFields("edit", {
                  title: editTitle, description: editDescription, location: editLocation, eventType: editEventType,
                  dressCode: editDressCode, reservation: editReservation, confirmation: editConfirmation, cost: editCost,
                  link: editLink, isOptional: editIsOptional, startTime: editStartTime, endTime: editEndTime,
                  date: editDate,
                }, {
                  setTitle: setEditTitle, setDescription: setEditDescription, setLocation: setEditLocation, setEventType: setEditEventType,
                  setDressCode: setEditDressCode, setReservation: setEditReservation, setConfirmation: setEditConfirmation, setCost: setEditCost,
                  setLink: setEditLink, setIsOptional: setEditIsOptional, setStartTime: setEditStartTime, setEndTime: setEditEndTime,
                  setDate: setEditDate,
                }, editLocationRef, true)}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                  <button onClick={cancelEdit} style={{ padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                  <button onClick={saveEdit} disabled={loading || !editTitle.trim()} className="btn" style={{ background: th.accent, padding: "10px 24px", fontSize: 13, fontWeight: 700, opacity: loading || !editTitle.trim() ? 0.5 : 1 }}>Save & Place</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ IMPORT MODAL — 3-step forgiving flow ═══ */}
      {showImportModal && (
        <div
          onClick={resetImport}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 620, maxHeight: "85vh",
              overflowY: "auto",
              background: th.bg, borderRadius: 16,
              boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
              padding: 0,
              animation: "slideUp 0.2s ease-out",
            }}
          >
            {/* Modal header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 2,
              background: th.bg, padding: "16px 20px 12px",
              borderBottom: `1px solid ${th.cardBorder}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18 }}>
                📥 Import Events {importStep > 1 && !importSuccess && `(Step ${importStep}/3)`}
              </span>
              <button onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: th.muted, padding: "4px 8px", borderRadius: 8, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px 24px" }}>
              {/* Step 1: Upload */}
              {importStep === 1 && (
                <>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFile(file);
                    }}
                  />
                  <div
                    onClick={() => importFileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleImportFile(file);
                    }}
                    style={{
                      border: `2px dashed ${th.cardBorder}`, borderRadius: 12,
                      padding: "48px 20px", textAlign: "center", cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = th.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = th.cardBorder; }}
                  >
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 6 }}>
                      Drop a file here or click to browse
                    </div>
                    <div style={{ fontSize: 13, color: th.muted }}>
                      Accepts .csv, .xlsx, .xls
                    </div>
                  </div>
                  {importError && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "#fce4ec", color: "#c62828", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                      {importError}
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Column Mapping */}
              {importStep === 2 && (
                <>
                  <div style={{ marginBottom: 16, fontSize: 13, color: th.muted }}>
                    Parsed <strong>{importRows.length}</strong> rows from <strong>{importFileName}</strong>. Map your columns to event fields:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {IMPORT_FIELD_OPTIONS.map((field) => (
                      <div key={field.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: th.text, minWidth: 100 }}>
                          {field.label}{field.required ? " *" : ""}
                        </span>
                        <select
                          value={importMapping[field.key] || ""}
                          onChange={(e) => setImportMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="input-modern"
                          style={{ flex: 1 }}
                        >
                          <option value="">— Not mapped —</option>
                          {importHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {/* Preview first 3 rows */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: th.text }}>Preview (first 3 rows)</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {IMPORT_FIELD_OPTIONS.filter((f) => importMapping[f.key]).map((f) => (
                              <th key={f.key} style={{ padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${th.cardBorder}`, color: th.muted, fontWeight: 700 }}>{f.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 3).map((row, i) => (
                            <tr key={i}>
                              {IMPORT_FIELD_OPTIONS.filter((f) => importMapping[f.key]).map((f) => (
                                <td key={f.key} style={{ padding: "6px 8px", borderBottom: `1px solid ${th.cardBorder}`, color: th.text, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {row[importMapping[f.key]] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setImportStep(1)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>Back</button>
                    <button
                      onClick={() => setImportStep(3)}
                      disabled={!importMapping.title}
                      className="btn"
                      style={{ background: th.accent, padding: "8px 20px", fontSize: 13, fontWeight: 700, opacity: !importMapping.title ? 0.4 : 1 }}
                    >
                      Preview Import
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Preview & Import */}
              {importStep === 3 && !importSuccess && !importLoading && !importError && (
                <>
                  {(() => {
                    const { ready, staging } = buildImportPreview;
                    const total = ready.length + staging.length;
                    return (
                      <>
                        <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
                          <strong>{total} event{total !== 1 ? "s" : ""} found.</strong>{" "}
                          {ready.length > 0 && <span style={{ color: "#2e7d32", fontWeight: 600 }}>{ready.length} ready for your itinerary</span>}
                          {ready.length > 0 && staging.length > 0 && ", "}
                          {staging.length > 0 && <span style={{ color: "#F57F17", fontWeight: 600 }}>{staging.length} need a date</span>}
                        </div>

                        {/* Ready events */}
                        {ready.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#2e7d32", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                              ✅ Ready to place ({ready.length})
                            </div>
                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                              {(() => {
                                const grouped: Record<string, typeof ready> = {};
                                ready.forEach((ev) => {
                                  const d = ev.date!;
                                  if (!grouped[d]) grouped[d] = [];
                                  grouped[d].push(ev);
                                });
                                return Object.keys(grouped).sort().map((date) => (
                                  <div key={date} style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: th.muted, marginBottom: 2 }}>{formatDate(date)}</div>
                                    {grouped[date].map((ev, i) => (
                                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 12px", fontSize: 12, borderBottom: `1px solid ${th.cardBorder}` }}>
                                        <span style={{ minWidth: 55, color: th.muted, fontWeight: 600 }}>{ev.start_time ? formatTime12h(ev.start_time) : "—"}</span>
                                        <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                                        {ev.location && <span style={{ color: th.muted, fontSize: 11 }}>📍 {ev.location}</span>}
                                      </div>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Staging events */}
                        {staging.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#F57F17", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                              📥 Going to staging ({staging.length})
                            </div>
                            <div style={{ maxHeight: 160, overflowY: "auto" }}>
                              {staging.map((ev, i) => (
                                <div key={i} style={{
                                  display: "flex", gap: 8, alignItems: "center",
                                  padding: "5px 12px", fontSize: 12,
                                  borderBottom: `1px solid ${th.cardBorder}`,
                                  background: "#FFF8E1",
                                }}>
                                  <span style={{ color: "#F9A825", fontWeight: 600, minWidth: 55 }}>No date</span>
                                  <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                                  {ev.location && <span style={{ color: th.muted, fontSize: 11 }}>📍 {ev.location}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => setImportStep(2)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>Back</button>
                          <button
                            onClick={executeImport}
                            disabled={total === 0}
                            className="btn"
                            style={{ background: th.accent, padding: "8px 20px", fontSize: 13, fontWeight: 700, opacity: total === 0 ? 0.4 : 1 }}
                          >
                            Import All ({total})
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* Import loading */}
              {importLoading && (
                <div style={{ textAlign: "center", padding: "32px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 12, animation: "spin 1s linear infinite" }}>⏳</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: th.muted }}>Importing events...</div>
                </div>
              )}

              {/* Import success */}
              {importSuccess && !importLoading && (
                <div style={{ textAlign: "center", padding: "32px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: th.text, marginBottom: 8 }}>
                    {importSuccess}
                  </div>
                  <button onClick={resetImport} className="btn" style={{ background: th.accent, padding: "10px 24px", fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                    Done
                  </button>
                </div>
              )}

              {/* Import error */}
              {importError && importStep === 3 && !importLoading && (
                <div style={{ textAlign: "center", padding: "32px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                  <div style={{ color: "#c62828", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{importError}</div>
                  <button onClick={() => { setImportError(""); setImportStep(2); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>Back</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
