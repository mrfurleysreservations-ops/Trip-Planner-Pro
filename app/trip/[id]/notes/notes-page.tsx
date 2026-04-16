"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES, NOTE_CONVERT_OPTIONS } from "@/lib/constants";
import { logActivity } from "@/lib/trip-activity";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Trip, TripNote, TripMember } from "@/types/database.types";
import type { NotesPageProps } from "./page";
import TripSubNav from "../trip-sub-nav";

// ─── Filter type ───
type FilterTab = "all" | "idea" | "finalized";

// ─── Status badge ───
const StatusBadge = ({ status, convertedTo, accent }: { status: string; convertedTo?: string | null; accent: string }) => {
  if (status === "finalized" && convertedTo) {
    const opt = NOTE_CONVERT_OPTIONS.find((o) => o.value === convertedTo);
    if (opt) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10,
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em",
          background: "#d4edda", color: "#155724",
        }}>
          <span>{opt.icon}</span> {opt.label}
        </span>
      );
    }
  }
  const isFinalized = status === "finalized";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 10,
      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
      background: isFinalized ? "#d4edda" : `${accent}18`,
      color: isFinalized ? "#155724" : accent,
    }}>
      {isFinalized ? "Finalized" : "Idea"}
    </span>
  );
};

export default function NotesPage({ trip, notes: initialNotes, members, userId, isHost, openNoteId }: NotesPageProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const th = THEMES[trip.trip_type] || THEMES.home;

  const [notes, setNotes] = useState<TripNote[]>(initialNotes);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(false);

  // ─── Modal state ───
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // ─── Add note form state ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addBody, setAddBody] = useState("");
  const [addLink, setAddLink] = useState("");

  // ─── Edit state ───
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editLink, setEditLink] = useState("");

  // ─── Delete confirmation (inside modal) ───
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Import state ───
  type ImportMethod = "text" | "file";
  type ImportStep = 1 | 2 | 3;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>(1);
  const [importMethod, setImportMethod] = useState<ImportMethod | null>(null);
  const [importPasteText, setImportPasteText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  type ParsedImportNote = { title: string; body: string | null; link_url: string | null };

  // ─── Convert menu + date/time picker (inside modal) ───
  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [convertDate, setConvertDate] = useState<string | null>(null);
  const [convertStartTime, setConvertStartTime] = useState("09:00");
  const [convertEndTime, setConvertEndTime] = useState("10:00");

  // ─── Auto-open note from ?note= deep-link (server prop) ───
  useEffect(() => {
    if (!openNoteId) return;
    const note = notes.find((n) => n.id === openNoteId);
    if (note) {
      setFilter("all");
      setSelectedNoteId(note.id);
    }
  }, [openNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Member name lookup ───
  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => {
      if (m.user_id) map[m.user_id] = m.name;
    });
    return map;
  }, [members]);

  const currentUserName = memberNameMap[userId] || "Someone";

  // ─── Filtered notes ───
  const filteredNotes = useMemo(() => {
    if (filter === "all") return notes;
    return notes.filter((n) => n.status === filter);
  }, [notes, filter]);

  // ─── Can edit: note creator or host ───
  const canEdit = useCallback((note: TripNote) => {
    return note.created_by === userId || isHost;
  }, [userId, isHost]);

  // ─── Actions ───

  const addNote = useCallback(async () => {
    if (!addTitle.trim()) return;
    setLoading(true);
    const minSort = notes.length > 0 ? Math.min(...notes.map((n) => n.sort_order)) - 1 : 0;
    const { data, error } = await supabase
      .from("trip_notes")
      .insert({
        trip_id: trip.id,
        created_by: userId,
        title: addTitle.trim(),
        body: addBody.trim() || null,
        link_url: addLink.trim() || null,
        status: "idea",
        sort_order: minSort,
      })
      .select()
      .single();
    if (error) {
      console.error("addNote error:", JSON.stringify(error, null, 2));
    } else if (data) {
      setNotes((prev) => [data as TripNote, ...prev]);
      logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "created", entityType: "note", entityName: addTitle.trim(), entityId: (data as TripNote).id, linkPath: `/trip/${trip.id}/notes?note=${(data as TripNote).id}` });
      setAddTitle("");
      setAddBody("");
      setAddLink("");
      setShowAddModal(false);
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, addTitle, addBody, addLink, notes]);

  const startEdit = useCallback((note: TripNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body || "");
    setEditLink(note.link_url || "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
    setEditLink("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from("trip_notes")
      .update({
        title: editTitle.trim(),
        body: editBody.trim() || null,
        link_url: editLink.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);
    if (error) {
      console.error("saveEdit error:", JSON.stringify(error, null, 2));
    } else {
      setNotes((prev) => prev.map((n) =>
        n.id === editingId
          ? { ...n, title: editTitle.trim(), body: editBody.trim() || null, link_url: editLink.trim() || null, updated_at: new Date().toISOString() }
          : n
      ));
      logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "edited", entityType: "note", entityName: editTitle.trim(), entityId: editingId, linkPath: `/trip/${trip.id}/notes?note=${editingId}` });
      // Stay in modal but exit edit mode
      setEditingId(null);
      setEditTitle("");
      setEditBody("");
      setEditLink("");
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, editingId, editTitle, editBody, editLink, cancelEdit]);

  const deleteNote = useCallback(async (noteId: string) => {
    setLoading(true);
    const deletedNote = notes.find((n) => n.id === noteId);
    const { error } = await supabase.from("trip_notes").delete().eq("id", noteId);
    if (error) {
      console.error("deleteNote error:", JSON.stringify(error, null, 2));
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setConfirmDeleteId(null);
      setSelectedNoteId(null);
      if (deletedNote) {
        logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "deleted", entityType: "note", entityName: deletedNote.title, entityId: noteId, linkPath: `/trip/${trip.id}/notes` });
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, notes]);

  const finalizeNote = useCallback(async (noteId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("trip_notes")
      .update({ status: "finalized", updated_at: new Date().toISOString() })
      .eq("id", noteId);
    if (error) {
      console.error("finalizeNote error:", JSON.stringify(error, null, 2));
    } else {
      const finalizedNote = notes.find((n) => n.id === noteId);
      setNotes((prev) => prev.map((n) =>
        n.id === noteId ? { ...n, status: "finalized", updated_at: new Date().toISOString() } : n
      ));
      if (finalizedNote) {
        logActivity(supabase, { tripId: trip.id, userId, userName: currentUserName, action: "finalized", entityType: "note", entityName: finalizedNote.title, entityId: noteId, linkPath: `/trip/${trip.id}/notes?note=${noteId}` });
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, notes]);

  // ─── Convert note to a specific destination ───
  const convertNote = useCallback(async (noteId: string, convertTo: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("trip_notes")
      .update({ status: "finalized", converted_to: convertTo, updated_at: new Date().toISOString() })
      .eq("id", noteId);
    if (!error) {
      setNotes((prev) => prev.map((n) =>
        n.id === noteId ? { ...n, status: "finalized", converted_to: convertTo } : n
      ));
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        logActivity(supabase, {
          tripId: trip.id, userId, userName: currentUserName,
          action: "converted", entityType: "note",
          entityName: `${note.title} → ${convertTo}`,
          entityId: noteId, linkPath: `/trip/${trip.id}/notes?note=${noteId}`,
        });
      }
    }
    setLoading(false);
  }, [supabase, trip.id, userId, currentUserName, notes]);

  // ─── Trip day list for date picker ───
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return [];
    const days: string[] = [];
    const s = new Date(trip.start_date + "T12:00:00");
    const e = new Date(trip.end_date + "T12:00:00");
    const cur = new Date(s);
    while (cur <= e) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [trip.start_date, trip.end_date]);

  const formatDayLabel = (dateStr: string): string => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  /** Convert note → navigate to itinerary with pre-filled event + selected date/time */
  const convertToEvent = useCallback((note: TripNote, date: string, startTime: string, endTime: string) => {
    const params = new URLSearchParams({
      fromNote: note.id,
      title: note.title,
      date,
      startTime,
      endTime,
      ...(note.body ? { description: note.body } : {}),
      ...(note.link_url ? { link: note.link_url } : {}),
    });
    router.push(`/trip/${trip.id}/itinerary?${params.toString()}`);
  }, [router, trip.id]);

  // ─── Import helpers ───

  const IMPORT_FIELD_OPTIONS = [
    { value: "", label: "— skip —" },
    { value: "title", label: "Title" },
    { value: "body", label: "Body / Details" },
    { value: "link_url", label: "Link URL" },
  ];

  const FIELD_KEYWORDS: Record<string, string[]> = {
    title: ["title", "name", "idea", "note", "subject", "heading", "item", "what"],
    body: ["body", "detail", "details", "description", "notes", "text", "content", "info", "comments"],
    link_url: ["link", "url", "website", "web", "href", "address", "site"],
  };

  const autoDetectMapping = useCallback((headers: string[]) => {
    const scores: Record<string, Record<string, number>> = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      Object.entries(FIELD_KEYWORDS).forEach(([field, keywords]) => {
        keywords.forEach((kw) => {
          if (lower === kw) { scores[h] = scores[h] || {}; scores[h][field] = (scores[h][field] || 0) + 3; }
          else if (lower.includes(kw)) { scores[h] = scores[h] || {}; scores[h][field] = (scores[h][field] || 0) + 1; }
        });
      });
    });
    const mapping: Record<string, string> = {};
    const used = new Set<string>();
    const pairs: { header: string; field: string; score: number }[] = [];
    Object.entries(scores).forEach(([header, fieldScores]) => {
      Object.entries(fieldScores).forEach(([field, score]) => {
        pairs.push({ header, field, score });
      });
    });
    pairs.sort((a, b) => b.score - a.score);
    pairs.forEach(({ header, field }) => {
      if (!mapping[header] && !used.has(field)) { mapping[header] = field; used.add(field); }
    });
    // Default: first unmapped header → title if title not yet assigned
    if (!used.has("title") && headers.length > 0) {
      const firstUnmapped = headers.find((h) => !mapping[h]);
      if (firstUnmapped) { mapping[firstUnmapped] = "title"; }
    }
    return mapping;
  }, []);

  /** Smart split: paragraphs separated by blank lines. Each paragraph's first line → title, rest → body. */
  const smartSplitText = useCallback((raw: string): ParsedImportNote[] => {
    const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const title = lines[0].replace(/^[-*•]\s*/, ""); // strip leading bullet
      const body = lines.length > 1 ? lines.slice(1).join("\n") : null;
      // Detect a URL in the block
      const urlMatch = block.match(/https?:\/\/[^\s)]+/);
      return { title, body, link_url: urlMatch ? urlMatch[0] : null };
    });
  }, []);

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
          const rows = results.data as Record<string, string>[];
          const headers = Object.keys(rows[0] || {});
          setImportHeaders(headers);
          setImportRows(rows);
          setImportMapping(autoDetectMapping(headers));
          setImportStep(2);
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
          if (json.length === 0) { setImportError("The spreadsheet appears to be empty."); return; }
          const headers = Object.keys(json[0]);
          setImportHeaders(headers);
          setImportRows(json);
          setImportMapping(autoDetectMapping(headers));
          setImportStep(2);
        } catch {
          setImportError("Failed to read spreadsheet.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setImportError("Unsupported file type. Please use .csv, .xlsx, or .xls.");
    }
  }, [autoDetectMapping]);

  /** Build preview from file rows + mapping */
  const fileImportPreview = useMemo((): ParsedImportNote[] => {
    if (importRows.length === 0) return [];
    const titleCol = Object.entries(importMapping).find(([, v]) => v === "title")?.[0];
    if (!titleCol) return [];
    const bodyCol = Object.entries(importMapping).find(([, v]) => v === "body")?.[0];
    const linkCol = Object.entries(importMapping).find(([, v]) => v === "link_url")?.[0];
    return importRows
      .map((row) => ({
        title: (row[titleCol] || "").trim(),
        body: bodyCol ? (row[bodyCol] || "").trim() || null : null,
        link_url: linkCol ? (row[linkCol] || "").trim() || null : null,
      }))
      .filter((n) => n.title.length > 0);
  }, [importRows, importMapping]);

  /** Build preview from pasted text */
  const textImportPreview = useMemo((): ParsedImportNote[] => {
    if (!importPasteText.trim()) return [];
    return smartSplitText(importPasteText);
  }, [importPasteText, smartSplitText]);

  /** Active preview based on method */
  const importPreview = importMethod === "text" ? textImportPreview : fileImportPreview;

  const resetImport = useCallback(() => {
    setShowImportModal(false);
    setImportStep(1);
    setImportMethod(null);
    setImportPasteText("");
    setImportFileName("");
    setImportHeaders([]);
    setImportRows([]);
    setImportMapping({});
    setImportError("");
    setImportSuccess("");
    setImportLoading(false);
  }, []);

  const executeImport = useCallback(async (items: ParsedImportNote[]) => {
    if (items.length === 0) return;
    setImportLoading(true);
    setImportError("");
    const baseSortOrder = notes.length > 0 ? Math.min(...notes.map((n) => n.sort_order)) - items.length : 0;
    const inserts = items.map((item, i) => ({
      trip_id: trip.id,
      created_by: userId,
      title: item.title,
      body: item.body,
      link_url: item.link_url,
      status: "idea" as const,
      sort_order: baseSortOrder + i,
    }));
    const { data, error } = await supabase.from("trip_notes").insert(inserts).select();
    if (error) {
      console.error("import error:", JSON.stringify(error, null, 2));
      setImportError("Import failed: " + error.message);
      setImportLoading(false);
      return;
    }
    if (data) {
      setNotes((prev) => [...(data as TripNote[]), ...prev]);
      logActivity(supabase, {
        tripId: trip.id, userId, userName: currentUserName,
        action: "imported", entityType: "note",
        entityName: `${data.length} note${data.length === 1 ? "" : "s"}`,
        linkPath: `/trip/${trip.id}/notes`,
      });
      setImportSuccess(`Imported ${data.length} note${data.length === 1 ? "" : "s"} successfully!`);
      setImportStep(3);
    }
    setImportLoading(false);
  }, [supabase, trip.id, userId, currentUserName, notes]);

  // ─── Helpers ───
  const filterTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
    fontWeight: active ? 700 : 500,
    background: active ? th.accent : "transparent",
    color: active ? "#fff" : th.muted,
    transition: "all 0.2s",
  });

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + "…" : text;

  // Selected note for modal
  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null;

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: th.headerBg, padding: "14px 20px", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push(`/trip/${trip.id}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", padding: "4px", color: th.muted }}>←</button>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "20px", color: th.text, margin: 0 }}>
            Notes
          </h2>
        </div>
      </div>

      <TripSubNav tripId={trip.id} theme={th} />

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px", position: "relative", zIndex: 1 }}>

        {/* ═══ FILTER TABS + ADD BUTTON ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, background: `${th.accent}0a`, borderRadius: 24, padding: 3 }}>
            <button style={filterTabStyle(filter === "all")} onClick={() => setFilter("all")}>All ({notes.length})</button>
            <button style={filterTabStyle(filter === "idea")} onClick={() => setFilter("idea")}>Ideas ({notes.filter((n) => n.status === "idea").length})</button>
            <button style={filterTabStyle(filter === "finalized")} onClick={() => setFilter("finalized")}>Finalized ({notes.filter((n) => n.status === "finalized").length})</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { resetImport(); setShowImportModal(true); }}
              style={{
                padding: "10px 16px", borderRadius: 10,
                border: `1.5px solid ${th.accent}`, background: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700,
                color: th.accent, fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Import
            </button>
          </div>
        </div>

        {/* ═══ NOTES LIST ═══ */}
        {filteredNotes.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: th.muted, fontSize: 14 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            {notes.length === 0 ? (
              <>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6, color: th.text }}>No notes yet</div>
                <div>Start capturing ideas, restaurants, activities — anything your group discovers while researching the trip.</div>
              </>
            ) : (
              <div>No {filter === "idea" ? "open ideas" : "finalized notes"} found.</div>
            )}
          </div>
        )}

        {filteredNotes.map((note) => {
          const creatorName = memberNameMap[note.created_by] || "Unknown";
          return (
            <div
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              style={{
                background: th.card,
                border: `1.5px solid ${th.cardBorder}`,
                borderRadius: 14,
                padding: 16, marginBottom: 12,
                cursor: "pointer",
                transition: "border-color 0.2s, transform 0.1s",
              }}
            >
              {/* Top row: title + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>📝</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {note.title}
                  </span>
                </div>
                <StatusBadge status={note.status} convertedTo={note.converted_to} accent={th.accent} />
              </div>

              {/* Body preview */}
              {note.body && (
                <div style={{ fontSize: 13, color: th.muted, lineHeight: 1.5, marginBottom: 8 }}>
                  {truncate(note.body, 120)}
                </div>
              )}

              {/* Footer: creator + link indicator */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: th.muted, fontWeight: 500 }}>
                  Added by {creatorName}
                </span>
                {note.link_url && (
                  <span style={{ fontSize: 11, color: th.accent, fontWeight: 600 }}>🔗 Has link</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Spacer for sticky CTA */}
        <div style={{ height: "80px" }} />

        {/* Sticky gradient CTA */}
        <div style={{
          position: "fixed",
          bottom: "56px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "480px",
          zIndex: 101,
          padding: "0 16px 12px",
          boxSizing: "border-box" as const,
          background: `linear-gradient(to top, ${th.bg} 70%, transparent)`,
          pointerEvents: "none" as const
        }}>
          <button onClick={() => { setShowAddModal(true); cancelEdit(); }} style={{
            pointerEvents: "auto" as const,
            width: "100%",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            minHeight: "52px"
          }}>
            + Add Note
          </button>
        </div>
      </div>

      {/* ═══ ADD NOTE BOTTOM-SHEET MODAL ═══ */}
      {showAddModal && (
        <div onClick={() => setShowAddModal(false)} style={{
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
            background: th.card || "#fff",
            animation: "slideUp 0.2s ease-out"
          }}>
            {/* Sticky modal header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 1,
              padding: "18px 20px 14px",
              borderBottom: `1px solid ${th.cardBorder}`,
              background: th.card || "#fff",
              borderRadius: "20px 20px 0 0",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", margin: 0 }}>
                Add Note
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{
                background: "none", border: "none", fontSize: "22px",
                cursor: "pointer", color: th.muted, padding: "4px"
              }}>✕</button>
            </div>

            {/* Form body */}
            <div style={{ padding: "16px 20px 24px" }}>
              <input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Title (required)"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "10px",
                  border: `1px solid ${th.cardBorder}`, fontSize: "14px",
                  fontFamily: "'DM Sans', sans-serif", marginBottom: 10,
                  boxSizing: "border-box", background: th.card, color: th.text,
                }}
                autoFocus
              />
              <textarea
                value={addBody}
                onChange={(e) => setAddBody(e.target.value)}
                placeholder="Details, thoughts, links... (optional)"
                rows={3}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "10px",
                  border: `1px solid ${th.cardBorder}`, fontSize: "14px",
                  fontFamily: "'DM Sans', sans-serif", marginBottom: 10,
                  resize: "vertical", minHeight: 60, boxSizing: "border-box",
                  background: th.card, color: th.text,
                }}
              />
              <input
                value={addLink}
                onChange={(e) => setAddLink(e.target.value)}
                placeholder="Link URL (optional)"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: "10px",
                  border: `1px solid ${th.cardBorder}`, fontSize: "14px",
                  fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                  background: th.card, color: th.text,
                }}
              />
            </div>

            {/* Sticky save button */}
            <div style={{
              position: "sticky", bottom: 0,
              padding: "12px 20px 20px",
              background: th.card || "#fff",
              borderTop: `1px solid ${th.cardBorder}`
            }}>
              <button
                onClick={addNote}
                disabled={loading || !addTitle.trim()}
                style={{
                  width: "100%", padding: "14px",
                  background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontSize: "15px", fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                  cursor: loading || !addTitle.trim() ? "not-allowed" : "pointer",
                  opacity: loading || !addTitle.trim() ? 0.5 : 1,
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOTE DETAIL MODAL ═══ */}
      {selectedNote && (
        <div
          onClick={() => { setSelectedNoteId(null); setConfirmDeleteId(null); cancelEdit(); setShowConvertMenu(false); setShowDatePicker(false); setConvertDate(null); }}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 20 }}>{editingId === selectedNote.id ? "✏️" : "📝"}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {editingId === selectedNote.id ? "Edit Note" : selectedNote.title}
                </span>
              </div>
              <button
                onClick={() => { setSelectedNoteId(null); setConfirmDeleteId(null); cancelEdit(); setShowConvertMenu(false); setShowDatePicker(false); setConvertDate(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: th.muted, padding: "4px 8px", borderRadius: 8, lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "16px 20px 24px" }}>

              {/* ─── EDIT MODE ─── */}
              {editingId === selectedNote.id ? (
                <>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title (required)"
                    className="input-modern"
                    style={{ marginBottom: 10 }}
                    autoFocus
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    placeholder="Details (optional)"
                    className="input-modern"
                    rows={4}
                    style={{ marginBottom: 10, resize: "vertical", minHeight: 80 }}
                  />
                  <input
                    value={editLink}
                    onChange={(e) => setEditLink(e.target.value)}
                    placeholder="Link URL (optional)"
                    className="input-modern"
                    style={{ marginBottom: 16 }}
                  />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: "10px 16px", borderRadius: 10,
                        border: `1.5px solid ${th.cardBorder}`, background: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: th.muted, fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={loading || !editTitle.trim()}
                      className="btn"
                      style={{
                        background: th.accent, padding: "10px 20px",
                        fontSize: 13, fontWeight: 700,
                        opacity: loading || !editTitle.trim() ? 0.5 : 1,
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </>
              ) : (
                /* ─── VIEW MODE ─── */
                <>
                  {/* Status badge */}
                  <div style={{ marginBottom: 14 }}>
                    <StatusBadge status={selectedNote.status} convertedTo={selectedNote.converted_to} accent={th.accent} />
                  </div>

                  {/* Body */}
                  {selectedNote.body && (
                    <div style={{ fontSize: 14, color: th.text, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>
                      {selectedNote.body}
                    </div>
                  )}

                  {/* Link */}
                  {selectedNote.link_url && (
                    <div style={{ marginBottom: 16 }}>
                      <a
                        href={selectedNote.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: th.accent, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span>🔗</span>
                        <span>{selectedNote.link_url.length > 60 ? selectedNote.link_url.slice(0, 60) + "…" : selectedNote.link_url}</span>
                      </a>
                    </div>
                  )}

                  {/* Creator info */}
                  <div style={{ fontSize: 12, color: th.muted, fontWeight: 500, marginBottom: 20 }}>
                    Added by {memberNameMap[selectedNote.created_by] || "Unknown"}
                  </div>

                  {/* ─── Convert To menu ─── */}
                  {selectedNote.status === "idea" && !showDatePicker && !showConvertMenu && (
                    <button
                      onClick={() => setShowConvertMenu(true)}
                      className="btn"
                      style={{
                        width: "100%", background: th.accent, padding: "12px 20px",
                        fontSize: 14, fontWeight: 700, marginBottom: 12,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      Convert To…
                    </button>
                  )}

                  {selectedNote.status === "idea" && showConvertMenu && !showDatePicker && (
                    <div style={{
                      marginBottom: 12, padding: 14, borderRadius: 12,
                      background: `${th.accent}08`, border: `1.5px solid ${th.accent}30`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: th.text, fontFamily: "'Outfit', sans-serif" }}>
                          Convert to…
                        </span>
                        <button
                          onClick={() => setShowConvertMenu(false)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: th.muted, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {NOTE_CONVERT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            disabled={loading}
                            onClick={async () => {
                              if (opt.value === "event") {
                                setShowConvertMenu(false);
                                setShowDatePicker(true);
                              } else if (opt.value === "packing") {
                                await convertNote(selectedNote.id, "packing");
                                const params = new URLSearchParams({
                                  fromNote: selectedNote.id,
                                  title: selectedNote.title,
                                  ...(selectedNote.body ? { body: selectedNote.body } : {}),
                                  ...(selectedNote.link_url ? { link_url: selectedNote.link_url } : {}),
                                });
                                router.push(`/trip/${trip.id}/packing?${params.toString()}`);
                              } else if (opt.value === "meal") {
                                await convertNote(selectedNote.id, "meal");
                                const params = new URLSearchParams({
                                  fromNote: selectedNote.id,
                                  title: selectedNote.title,
                                  ...(selectedNote.body ? { body: selectedNote.body } : {}),
                                  ...(selectedNote.link_url ? { link_url: selectedNote.link_url } : {}),
                                });
                                router.push(`/trip/${trip.id}/meals?${params.toString()}`);
                              } else if (opt.value === "reference") {
                                await convertNote(selectedNote.id, "reference");
                                setShowConvertMenu(false);
                                setSelectedNoteId(null);
                              }
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "10px 14px", borderRadius: 10,
                              border: `1.5px solid ${th.cardBorder}`, background: th.card,
                              cursor: loading ? "not-allowed" : "pointer",
                              textAlign: "left", fontFamily: "'DM Sans', sans-serif",
                              transition: "border-color 0.15s, background 0.15s",
                              opacity: loading ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.accent; (e.currentTarget as HTMLElement).style.background = `${th.accent}10`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.cardBorder; (e.currentTarget as HTMLElement).style.background = th.card; }}
                          >
                            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{opt.label}</div>
                              <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>{opt.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── Date + Time picker step ─── */}
                  {selectedNote.status === "idea" && showDatePicker && (
                    <div style={{
                      marginBottom: 12, padding: 16, borderRadius: 12,
                      background: `${th.accent}08`, border: `1.5px solid ${th.accent}30`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: th.text }}>
                          {!convertDate ? "Pick a day" : "Pick a time"}
                        </span>
                        <button
                          onClick={() => { setShowDatePicker(false); setConvertDate(null); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: th.muted, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Step 1: Date pills */}
                      {!convertDate && (
                        tripDays.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {tripDays.map((day) => (
                              <button
                                key={day}
                                onClick={() => setConvertDate(day)}
                                style={{
                                  padding: "8px 14px", borderRadius: 10,
                                  border: `1.5px solid ${th.accent}`,
                                  background: `${th.accent}10`, cursor: "pointer",
                                  fontSize: 13, fontWeight: 600, color: th.accent,
                                  fontFamily: "'DM Sans', sans-serif",
                                  transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = th.accent; (e.target as HTMLElement).style.color = "#fff"; }}
                                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = `${th.accent}10`; (e.target as HTMLElement).style.color = th.accent; }}
                              >
                                {formatDayLabel(day)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: th.muted }}>
                            Set trip dates first to pick a day.
                          </div>
                        )
                      )}

                      {/* Step 2: Time inputs + confirm */}
                      {convertDate && (
                        <>
                          <div style={{
                            display: "inline-block", padding: "4px 10px", borderRadius: 8,
                            background: th.accent, color: "#fff", fontSize: 12, fontWeight: 700,
                            marginBottom: 12,
                          }}>
                            {formatDayLabel(convertDate)}
                            <button
                              onClick={() => setConvertDate(null)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 12, marginLeft: 6, fontFamily: "'DM Sans', sans-serif" }}
                            >
                              change
                            </button>
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>Start</label>
                              <input
                                type="time"
                                value={convertStartTime}
                                onChange={(e) => setConvertStartTime(e.target.value)}
                                className="input-modern"
                                style={{ width: "100%" }}
                              />
                            </div>
                            <span style={{ color: th.muted, marginTop: 16 }}>-</span>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: th.muted, display: "block", marginBottom: 4 }}>End</label>
                              <input
                                type="time"
                                value={convertEndTime}
                                onChange={(e) => setConvertEndTime(e.target.value)}
                                className="input-modern"
                                style={{ width: "100%" }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => convertToEvent(selectedNote, convertDate, convertStartTime, convertEndTime)}
                            className="btn"
                            style={{
                              width: "100%", background: th.accent, padding: "12px 20px",
                              fontSize: 14, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                          >
                            Create Event
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Edit / Delete */}
                  {canEdit(selectedNote) && (
                    <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: `1px solid ${th.cardBorder}` }}>
                      <button
                        onClick={() => startEdit(selectedNote)}
                        style={{
                          flex: 1, padding: "10px 16px", borderRadius: 10,
                          border: `1.5px solid ${th.cardBorder}`, background: "none",
                          cursor: "pointer", fontSize: 13, fontWeight: 700,
                          color: th.text, fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Edit Note
                      </button>
                      {confirmDeleteId !== selectedNote.id ? (
                        <button
                          onClick={() => setConfirmDeleteId(selectedNote.id)}
                          style={{
                            padding: "10px 16px", borderRadius: 10,
                            border: "1.5px solid #ffcdd2", background: "none",
                            cursor: "pointer", fontSize: 13, fontWeight: 700,
                            color: "#c0392b", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>Sure?</span>
                          <button onClick={() => deleteNote(selectedNote.id)} disabled={loading} style={{ padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "#c0392b", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.5 : 1 }}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>No</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ IMPORT MODAL ═══ */}
      {showImportModal && (
        <div
          onClick={resetImport}
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
              width: "100%", maxWidth: 600, maxHeight: "85vh",
              overflowY: "auto",
              background: th.bg, borderRadius: "20px 20px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
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
                Import Notes
              </span>
              <button onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: th.muted, padding: "4px 8px", borderRadius: 8, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: "16px 20px 24px" }}>

              {/* ─── SUCCESS STATE ─── */}
              {importSuccess && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: th.text, marginBottom: 8 }}>
                    {importSuccess}
                  </div>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 24 }}>
                    Your imported notes are ready to review. Finalize the ones you like and convert them into events, packing items, or meals.
                  </div>
                  <button onClick={resetImport} className="btn" style={{ background: th.accent, padding: "12px 28px", fontSize: 14, fontWeight: 700 }}>
                    Done
                  </button>
                </div>
              )}

              {/* ─── STEP 1: Choose method ─── */}
              {!importSuccess && importStep === 1 && !importMethod && (
                <>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 16 }}>
                    Already have notes from planning? Bring them in — paste from your phone, a doc, or upload a spreadsheet.
                  </div>
                  {importError && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fdecea", color: "#c0392b", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                      {importError}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      onClick={() => { setImportMethod("text"); setImportStep(2); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "16px 18px", borderRadius: 12,
                        border: `1.5px solid ${th.cardBorder}`, background: th.card,
                        cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.accent; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.cardBorder; }}
                    >
                      <span style={{ fontSize: 28, lineHeight: 1 }}>📋</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>Paste Text</div>
                        <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>From your phone notes, messages, docs, emails — anything</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setImportMethod("file"); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "16px 18px", borderRadius: 12,
                        border: `1.5px solid ${th.cardBorder}`, background: th.card,
                        cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.accent; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.cardBorder; }}
                    >
                      <span style={{ fontSize: 28, lineHeight: 1 }}>📊</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>Upload Spreadsheet</div>
                        <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>CSV or Excel file with columns for title, details, links</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* ─── FILE METHOD: Step 1 — Upload ─── */}
              {!importSuccess && importMethod === "file" && importStep === 1 && (
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
                  {importError && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fdecea", color: "#c0392b", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                      {importError}
                    </div>
                  )}
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.accent; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = th.cardBorder; }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: th.text, marginBottom: 4 }}>
                      Drop your file here or click to browse
                    </div>
                    <div style={{ fontSize: 12, color: th.muted }}>
                      Supports .csv, .xlsx, .xls
                    </div>
                  </div>
                  <button
                    onClick={() => { setImportMethod(null); setImportError(""); }}
                    style={{ marginTop: 14, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ← Back
                  </button>
                </>
              )}

              {/* ─── FILE METHOD: Step 2 — Column mapping ─── */}
              {!importSuccess && importMethod === "file" && importStep === 2 && (
                <>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 4 }}>
                    <strong style={{ color: th.text }}>{importFileName}</strong> — {importRows.length} row{importRows.length === 1 ? "" : "s"} found
                  </div>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 16 }}>
                    Map your columns to note fields. At minimum, map a <strong style={{ color: th.text }}>Title</strong> column.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {importHeaders.map((header) => (
                      <div key={header} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          flex: 1, fontSize: 13, fontWeight: 600, color: th.text,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {header}
                        </span>
                        <span style={{ fontSize: 13, color: th.muted }}>→</span>
                        <select
                          value={importMapping[header] || ""}
                          onChange={(e) => setImportMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                          className="input-modern"
                          style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
                        >
                          {IMPORT_FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Preview first 3 rows */}
                  {fileImportPreview.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                        Preview ({fileImportPreview.length} note{fileImportPreview.length === 1 ? "" : "s"})
                      </div>
                      {fileImportPreview.slice(0, 3).map((n, i) => (
                        <div key={i} style={{
                          padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                          background: `${th.accent}08`, border: `1px solid ${th.accent}20`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>{n.body.length > 80 ? n.body.slice(0, 80) + "…" : n.body}</div>}
                          {n.link_url && <div style={{ fontSize: 11, color: th.accent, marginTop: 2 }}>🔗 {n.link_url.length > 50 ? n.link_url.slice(0, 50) + "…" : n.link_url}</div>}
                        </div>
                      ))}
                      {fileImportPreview.length > 3 && (
                        <div style={{ fontSize: 12, color: th.muted, fontStyle: "italic" }}>
                          + {fileImportPreview.length - 3} more…
                        </div>
                      )}
                    </div>
                  )}

                  {importError && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fdecea", color: "#c0392b", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                      {importError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setImportStep(1); setImportMethod(null); setImportHeaders([]); setImportRows([]); setImportMapping({}); setImportFileName(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                      Back
                    </button>
                    <button
                      onClick={() => executeImport(fileImportPreview)}
                      disabled={importLoading || fileImportPreview.length === 0}
                      className="btn"
                      style={{
                        background: th.accent, padding: "10px 24px", fontSize: 13, fontWeight: 700,
                        opacity: importLoading || fileImportPreview.length === 0 ? 0.5 : 1,
                      }}
                    >
                      {importLoading ? "Importing…" : `Import ${fileImportPreview.length} Note${fileImportPreview.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </>
              )}

              {/* ─── TEXT METHOD: Step 2 — Paste + preview ─── */}
              {!importSuccess && importMethod === "text" && importStep === 2 && (
                <>
                  <div style={{ fontSize: 13, color: th.muted, marginBottom: 12 }}>
                    Paste your notes below. Separate each idea with a blank line — the first line of each block becomes the title, and the rest becomes the details.
                  </div>
                  <textarea
                    value={importPasteText}
                    onChange={(e) => setImportPasteText(e.target.value)}
                    placeholder={"Restaurant on Main St\nGreat reviews, reservations needed\nhttps://example.com\n\nHike at Sunset Ridge\nBring water, 2 hour trail\n\nMarket on Saturday morning"}
                    className="input-modern"
                    rows={8}
                    style={{ marginBottom: 14, resize: "vertical", minHeight: 120, fontSize: 13, lineHeight: 1.6 }}
                    autoFocus
                  />

                  {/* Live preview */}
                  {textImportPreview.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: th.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                        Preview ({textImportPreview.length} note{textImportPreview.length === 1 ? "" : "s"})
                      </div>
                      {textImportPreview.slice(0, 5).map((n, i) => (
                        <div key={i} style={{
                          padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                          background: `${th.accent}08`, border: `1px solid ${th.accent}20`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>📝 {n.title}</div>
                          {n.body && <div style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>{n.body.length > 100 ? n.body.slice(0, 100) + "…" : n.body}</div>}
                          {n.link_url && <div style={{ fontSize: 11, color: th.accent, marginTop: 2 }}>🔗 {n.link_url.length > 50 ? n.link_url.slice(0, 50) + "…" : n.link_url}</div>}
                        </div>
                      ))}
                      {textImportPreview.length > 5 && (
                        <div style={{ fontSize: 12, color: th.muted, fontStyle: "italic" }}>
                          + {textImportPreview.length - 5} more…
                        </div>
                      )}
                    </div>
                  )}

                  {importError && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fdecea", color: "#c0392b", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                      {importError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setImportStep(1); setImportMethod(null); setImportPasteText(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${th.cardBorder}`, background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: th.muted, fontFamily: "'DM Sans', sans-serif" }}>
                      Back
                    </button>
                    <button
                      onClick={() => executeImport(textImportPreview)}
                      disabled={importLoading || textImportPreview.length === 0}
                      className="btn"
                      style={{
                        background: th.accent, padding: "10px 24px", fontSize: 13, fontWeight: 700,
                        opacity: importLoading || textImportPreview.length === 0 ? 0.5 : 1,
                      }}
                    >
                      {importLoading ? "Importing…" : `Import ${textImportPreview.length} Note${textImportPreview.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Modal animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
