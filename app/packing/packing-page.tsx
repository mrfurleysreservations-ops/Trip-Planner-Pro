"use client";
import { useState, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/constants";
import { ageIcon } from "@/lib/utils";
import MemberSlider from "@/app/components/member-slider";
import type { SuitcaseItem, SuitcasePhoto, WardrobeItem, OutfitWithItems, OutfitItem } from "@/types/database.types";
import type { SuitcaseWithItems, FamilyWithMembers } from "./page";

// ─── Expanded categories with suggestions ───

const SUITCASE_CATEGORIES = [
  { value: "tops", label: "Tops", icon: "👕", suggestions: ["T-shirts", "Dress shirts", "Polos", "Tank tops", "Long sleeves"] },
  { value: "bottoms", label: "Bottoms", icon: "👖", suggestions: ["Jeans", "Shorts", "Dress pants", "Sweats", "Skirts"] },
  { value: "outerwear", label: "Outerwear", icon: "🧥", suggestions: ["Jacket", "Hoodie", "Rain coat", "Vest", "Fleece"] },
  { value: "underwear_socks", label: "Underwear & Socks", icon: "🩲", suggestions: ["Underwear", "Bras", "Socks", "Undershirts"] },
  { value: "shoes", label: "Shoes", icon: "👟", suggestions: ["Sneakers", "Sandals", "Dress shoes", "Hiking boots", "Flip flops"] },
  { value: "sleepwear", label: "Sleepwear", icon: "😴", suggestions: ["Pajamas", "Robe", "Slippers"] },
  { value: "swimwear", label: "Swimwear", icon: "🩱", suggestions: ["Swim trunks", "Bikini", "Cover-up", "Goggles"] },
  { value: "toiletries", label: "Toiletries", icon: "🧴", suggestions: ["Toothbrush", "Deodorant", "Shampoo", "Sunscreen", "Medications"] },
  { value: "electronics", label: "Electronics", icon: "🔌", suggestions: ["Chargers", "Headphones", "Tablet", "Camera", "Power bank"] },
  { value: "documents", label: "Documents & Money", icon: "📄", suggestions: ["Passport", "ID", "Insurance cards", "Cash", "Credit cards"] },
  { value: "accessories", label: "Accessories", icon: "🎒", suggestions: ["Sunglasses", "Hat", "Belt", "Watch", "Jewelry", "Umbrella"] },
  { value: "other", label: "Other", icon: "📦", suggestions: [] },
];

// ─── Isolated item row: local state, save on blur/Enter ───
function SuitcaseItemRow({ item, accent, onTogglePacked, onUpdate, onDelete }: {
  item: SuitcaseItem;
  accent: string;
  onTogglePacked: () => void;
  onUpdate: (field: string, value: string | number) => void;
  onDelete: () => void;
}) {
  const [localName, setLocalName] = useState(item.item_name);
  const [localQty, setLocalQty] = useState(String(item.quantity));
  const [localCat, setLocalCat] = useState(item.category || "other");

  const commitName = () => { if (localName !== item.item_name) onUpdate("item_name", localName); };
  const commitQty = () => { const n = parseInt(localQty) || 1; if (n !== item.quantity) onUpdate("quantity", n); };
  const commitCat = (v: string) => { setLocalCat(v); onUpdate("category", v); };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #eee" }}>
      <div
        onClick={onTogglePacked}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${item.packed ? accent : "#ccc"}`, background: item.packed ? accent : "#fff", cursor: "pointer", flexShrink: 0 }}
      >
        {item.packed && <span style={{ color: "#fff", fontSize: "13px", fontWeight: 700 }}>✓</span>}
      </div>
      <input
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === "Enter") { commitName(); (e.target as HTMLInputElement).blur(); } }}
        className="input-modern"
        style={{ flex: 1, minWidth: "80px", textDecoration: item.packed ? "line-through" : "none", opacity: item.packed ? 0.5 : 1 }}
      />
      <select
        value={localCat}
        onChange={(e) => commitCat(e.target.value)}
        className="input-modern"
        style={{ width: "auto", minWidth: "100px", padding: "4px 8px", fontSize: "12px" }}
      >
        {SUITCASE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
      </select>
      <input
        type="number"
        value={localQty}
        onChange={(e) => setLocalQty(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => { if (e.key === "Enter") { commitQty(); (e.target as HTMLInputElement).blur(); } }}
        className="input-modern"
        style={{ width: "50px", textAlign: "center", padding: "4px" }}
        min={1}
      />
      <button onClick={onDelete} className="btn btn-sm" style={{ background: "#e74c3c", padding: "4px 8px", fontSize: "11px" }}>✕</button>
    </div>
  );
}

interface PackingPageProps {
  userId: string;
  initialSuitcases: SuitcaseWithItems[];
  families: FamilyWithMembers[];
  initialWardrobeItems?: WardrobeItem[];
  initialOutfits?: OutfitWithItems[];
  tripId?: string | null;
  tripType?: string | null;
  /** For trip-scoped usage: flat list of person names from trip families JSON */
  tripMembers?: { name: string; age_type: string }[];
  /** Current user's profile display name (for avatar fallback matching) */
  userName?: string | null;
  /** Current user's profile avatar URL (fallback for their family member entry) */
  userAvatarUrl?: string | null;
}

export default function PackingPage({ userId, initialSuitcases, families, initialWardrobeItems = [], initialOutfits = [], tripId = null, tripType = null, tripMembers, userName = null, userAvatarUrl = null }: PackingPageProps) {
  const [suitcases, setSuitcases] = useState<SuitcaseWithItems[]>(initialSuitcases);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newSuitcaseName, setNewSuitcaseName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [orgPhotosOpen, setOrgPhotosOpen] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>(initialWardrobeItems);
  const [wardrobeMode, setWardrobeMode] = useState(false);
  const [newWardrobeName, setNewWardrobeName] = useState("");
  const [newWardrobeCat, setNewWardrobeCat] = useState("tops");
  // Wardrobe modal state
  const [wardrobeModalOpen, setWardrobeModalOpen] = useState(false);
  const [newWardrobePhoto, setNewWardrobePhoto] = useState<File | null>(null);
  const [newWardrobePhotoPreview, setNewWardrobePhotoPreview] = useState<string | null>(null);
  // Wardrobe tab state
  const [wardrobeTab, setWardrobeTab] = useState<"items" | "outfits">("items");
  // Outfit state
  const [outfits, setOutfits] = useState<OutfitWithItems[]>(initialOutfits);
  const [outfitModalOpen, setOutfitModalOpen] = useState(false);
  const [newOutfitName, setNewOutfitName] = useState("");
  const [newOutfitPhoto, setNewOutfitPhoto] = useState<File | null>(null);
  const [newOutfitPhotoPreview, setNewOutfitPhotoPreview] = useState<string | null>(null);
  const [selectedOutfitItemIds, setSelectedOutfitItemIds] = useState<Set<string>>(new Set());
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const th = THEMES.home;

  // Refs for hidden file inputs
  const suitcasePhotoInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const orgPhotoInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const wardrobePhotoInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const wardrobeModalPhotoRef = useRef<HTMLInputElement | null>(null);
  const outfitModalPhotoRef = useRef<HTMLInputElement | null>(null);

  // Build the person list: either from tripMembers (trip-scoped) or from families (standalone page)
  const allMembers: { name: string; age_type: string; avatar_url?: string | null; familyName: string }[] = tripMembers
    ? tripMembers.map((m) => ({ ...m, familyName: "" }))
    : families.flatMap((f) =>
        f.family_members.map((m) => ({ name: m.name, age_type: m.age_type || "adult", avatar_url: m.avatar_url || (m.name === userName ? userAvatarUrl : null), familyName: f.name }))
      );

  // Dedupe by name (in case same name across families)
  const uniqueMembers = allMembers.filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i);

  const templates = suitcases.filter((s) => s.is_template);
  const activeSuitcases = suitcases.filter((s) => !s.is_template);
  const personSuitcases = selectedPerson ? activeSuitcases.filter((s) => s.person_name === selectedPerson) : [];
  const personWardrobe = selectedPerson ? wardrobeItems.filter((w) => w.person_name === selectedPerson) : [];
  const personOutfits = selectedPerson ? outfits.filter((o) => o.person_name === selectedPerson) : [];

  // Count suitcases per person for the selector badges
  const countFor = (name: string) => activeSuitcases.filter((s) => s.person_name === name).length;
  const packedCountFor = (name: string) => {
    const items = activeSuitcases.filter((s) => s.person_name === name).flatMap((s) => s.suitcase_items);
    return items.length === 0 ? null : `${items.filter((i) => i.packed).length}/${items.length}`;
  };

  // ─── CRUD ───

  const createSuitcase = async () => {
    if (!selectedPerson) return;
    const name = newSuitcaseName.trim() || "Suitcase";
    const { data } = await supabase.from("suitcases").insert({
      owner_id: userId,
      trip_id: tripId,
      person_name: selectedPerson,
      name,
    }).select("*, suitcase_items(*), suitcase_photos(*)").single();
    if (data) {
      setSuitcases((prev) => [...prev, data as SuitcaseWithItems]);
      setNewSuitcaseName("");
      setOpenId(data.id);
    }
  };

  const deleteSuitcase = async (id: string) => {
    await supabase.from("suitcases").delete().eq("id", id);
    setSuitcases((prev) => prev.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
  };

  const saveAsTemplate = async (s: SuitcaseWithItems) => {
    const { data } = await supabase.from("suitcases").insert({
      owner_id: userId,
      trip_id: null,
      person_name: s.person_name,
      name: s.name + " (Template)",
      is_template: true,
    }).select().single();
    if (!data) return;
    const items = s.suitcase_items.map((i) => ({
      suitcase_id: data.id,
      item_name: i.item_name,
      category: i.category,
      quantity: i.quantity,
      packed: false,
    }));
    if (items.length > 0) {
      await supabase.from("suitcase_items").insert(items);
    }
    const { data: full } = await supabase.from("suitcases").select("*, suitcase_items(*), suitcase_photos(*)").eq("id", data.id).single();
    if (full) setSuitcases((prev) => [...prev, full as SuitcaseWithItems]);
  };

  const loadFromTemplate = async (template: SuitcaseWithItems) => {
    if (!selectedPerson) return;
    const { data } = await supabase.from("suitcases").insert({
      owner_id: userId,
      trip_id: tripId,
      person_name: selectedPerson,
      name: template.name.replace(" (Template)", ""),
      is_template: false,
    }).select().single();
    if (!data) return;
    const items = template.suitcase_items.map((i) => ({
      suitcase_id: data.id,
      item_name: i.item_name,
      category: i.category,
      quantity: i.quantity,
      packed: false,
    }));
    if (items.length > 0) {
      await supabase.from("suitcase_items").insert(items);
    }
    const { data: full } = await supabase.from("suitcases").select("*, suitcase_items(*), suitcase_photos(*)").eq("id", data.id).single();
    if (full) {
      setSuitcases((prev) => [...prev, full as SuitcaseWithItems]);
      setOpenId(data.id);
      setShowTemplates(false);
    }
  };

  // ─── Item CRUD ───

  const addItem = async (suitcaseId: string) => {
    const { data } = await supabase.from("suitcase_items").insert({
      suitcase_id: suitcaseId,
      item_name: "New Item",
    }).select().single();
    if (data) {
      setSuitcases((prev) => prev.map((s) =>
        s.id === suitcaseId ? { ...s, suitcase_items: [...s.suitcase_items, data as SuitcaseItem] } : s
      ));
    }
  };

  const addFromWardrobe = async (suitcaseId: string, w: WardrobeItem) => {
    const { data } = await supabase.from("suitcase_items").insert({
      suitcase_id: suitcaseId,
      item_name: w.item_name,
      category: w.category,
      wardrobe_item_id: w.id,
      quantity: 1,
      packed: false,
    }).select().single();
    if (data) {
      setSuitcases((prev) => prev.map((s) =>
        s.id === suitcaseId ? { ...s, suitcase_items: [...s.suitcase_items, data as SuitcaseItem] } : s
      ));
    }
  };

  const updateItem = async (suitcaseId: string, itemId: string, field: string, value: string | number | boolean) => {
    await supabase.from("suitcase_items").update({ [field]: value }).eq("id", itemId);
    setSuitcases((prev) => prev.map((s) =>
      s.id === suitcaseId
        ? { ...s, suitcase_items: s.suitcase_items.map((i) => i.id === itemId ? { ...i, [field]: value } : i) }
        : s
    ));

    // Auto-save to wardrobe when item name is committed (not the default placeholder)
    if (field === "item_name" && typeof value === "string" && value !== "New Item" && selectedPerson) {
      const item = suitcases.flatMap((s) => s.suitcase_items).find((i) => i.id === itemId);
      const itemCategory = item?.category || "other";
      const alreadyInWardrobe = wardrobeItems.some(
        (w) => w.person_name === selectedPerson && w.item_name.toLowerCase() === value.toLowerCase()
      );
      if (!alreadyInWardrobe) {
        const { data: wData } = await supabase.from("wardrobe_items").insert({
          owner_id: userId,
          person_name: selectedPerson,
          item_name: value,
          category: itemCategory,
        }).select().single();
        if (wData) {
          setWardrobeItems((prev) => [...prev, wData as WardrobeItem]);
          // Link the suitcase item to the new wardrobe entry
          await supabase.from("suitcase_items").update({ wardrobe_item_id: wData.id }).eq("id", itemId);
          setSuitcases((prev) => prev.map((s) =>
            s.id === suitcaseId
              ? { ...s, suitcase_items: s.suitcase_items.map((i) => i.id === itemId ? { ...i, wardrobe_item_id: wData.id } : i) }
              : s
          ));
        }
      } else if (!item?.wardrobe_item_id) {
        // Item exists in wardrobe but suitcase item isn't linked — link it
        const existing = wardrobeItems.find(
          (w) => w.person_name === selectedPerson && w.item_name.toLowerCase() === value.toLowerCase()
        );
        if (existing) {
          await supabase.from("suitcase_items").update({ wardrobe_item_id: existing.id }).eq("id", itemId);
          setSuitcases((prev) => prev.map((s) =>
            s.id === suitcaseId
              ? { ...s, suitcase_items: s.suitcase_items.map((i) => i.id === itemId ? { ...i, wardrobe_item_id: existing.id } : i) }
              : s
          ));
        }
      }
    }
  };

  const deleteItem = async (suitcaseId: string, itemId: string) => {
    await supabase.from("suitcase_items").delete().eq("id", itemId);
    setSuitcases((prev) => prev.map((s) =>
      s.id === suitcaseId ? { ...s, suitcase_items: s.suitcase_items.filter((i) => i.id !== itemId) } : s
    ));
  };

  const packedCount = (items: SuitcaseItem[]) => items.filter((i) => i.packed).length;

  // ─── Suitcase identity photo upload (Feature 1) ───

  const uploadSuitcasePhoto = async (suitcaseId: string, file: File) => {
    const path = `${userId}/${suitcaseId}.jpg`;
    const { error: uploadError } = await supabase.storage.from("suitcase-photos").upload(path, file, { upsert: true });
    if (uploadError) { console.error("Upload failed:", uploadError); return; }
    const { data: urlData } = supabase.storage.from("suitcase-photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from("suitcases").update({ photo_url: photoUrl }).eq("id", suitcaseId);
    setSuitcases((prev) => prev.map((s) => s.id === suitcaseId ? { ...s, photo_url: photoUrl } : s));
  };

  // ─── Organization photo CRUD (Feature 2) ───

  const uploadOrgPhoto = async (suitcaseId: string, file: File) => {
    const path = `${suitcaseId}/org-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from("suitcase-photos").upload(path, file);
    if (uploadError) { console.error("Org photo upload failed:", uploadError); return; }
    const { data: urlData } = supabase.storage.from("suitcase-photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;
    const { data } = await supabase.from("suitcase_photos").insert({
      suitcase_id: suitcaseId,
      photo_url: photoUrl,
    }).select().single();
    if (data) {
      setSuitcases((prev) => prev.map((s) =>
        s.id === suitcaseId ? { ...s, suitcase_photos: [...(s.suitcase_photos || []), data as SuitcasePhoto] } : s
      ));
    }
  };

  const deleteOrgPhoto = async (suitcaseId: string, photoId: string) => {
    await supabase.from("suitcase_photos").delete().eq("id", photoId);
    setSuitcases((prev) => prev.map((s) =>
      s.id === suitcaseId ? { ...s, suitcase_photos: (s.suitcase_photos || []).filter((p) => p.id !== photoId) } : s
    ));
  };

  // ─── Category group toggle ───

  const toggleCategoryCollapse = (suitcaseId: string, catValue: string) => {
    const key = `${suitcaseId}:${catValue}`;
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Wardrobe CRUD ───

  const addWardrobeItem = async (): Promise<string | null> => {
    if (!selectedPerson || !newWardrobeName.trim()) return null;
    const { data } = await supabase.from("wardrobe_items").insert({
      owner_id: userId,
      person_name: selectedPerson,
      item_name: newWardrobeName.trim(),
      category: newWardrobeCat,
    }).select().single();
    if (data) {
      setWardrobeItems((prev) => [...prev, data as WardrobeItem]);
      setNewWardrobeName("");
      return data.id;
    }
    return null;
  };

  const deleteWardrobeItem = async (id: string) => {
    await supabase.from("wardrobe_items").delete().eq("id", id);
    setWardrobeItems((prev) => prev.filter((w) => w.id !== id));
  };

  const uploadWardrobePhoto = async (wardrobeItemId: string, file: File) => {
    const path = `wardrobe/${userId}/${wardrobeItemId}.jpg`;
    const { error: uploadError } = await supabase.storage.from("suitcase-photos").upload(path, file, { upsert: true });
    if (uploadError) { console.error("Wardrobe photo upload failed:", uploadError); return; }
    const { data: urlData } = supabase.storage.from("suitcase-photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;
    await supabase.from("wardrobe_items").update({ photo_url: photoUrl }).eq("id", wardrobeItemId);
    setWardrobeItems((prev) => prev.map((w) => w.id === wardrobeItemId ? { ...w, photo_url: photoUrl } : w));
  };

  // ─── Wardrobe modal helpers ───

  const closeWardrobeModal = () => {
    if (newWardrobePhotoPreview) URL.revokeObjectURL(newWardrobePhotoPreview);
    setNewWardrobeName("");
    setNewWardrobeCat("tops");
    setNewWardrobePhoto(null);
    setNewWardrobePhotoPreview(null);
    setWardrobeModalOpen(false);
  };

  const saveWardrobeFromModal = async () => {
    const id = await addWardrobeItem();
    if (id && newWardrobePhoto) {
      await uploadWardrobePhoto(id, newWardrobePhoto);
    }
    if (newWardrobePhotoPreview) URL.revokeObjectURL(newWardrobePhotoPreview);
    setNewWardrobeName("");
    setNewWardrobeCat("tops");
    setNewWardrobePhoto(null);
    setNewWardrobePhotoPreview(null);
    setWardrobeModalOpen(false);
  };

  // ─── Outfit CRUD ───

  const createOutfit = async () => {
    if (!selectedPerson || !newOutfitName.trim() || selectedOutfitItemIds.size === 0) return null;
    const { data } = await supabase.from("outfits").insert({
      owner_id: userId,
      person_name: selectedPerson,
      name: newOutfitName.trim(),
    }).select().single();
    if (!data) return null;
    const items = Array.from(selectedOutfitItemIds).map((wId, i) => ({
      outfit_id: data.id,
      wardrobe_item_id: wId,
      sort_order: i,
    }));
    await supabase.from("outfit_items").insert(items);
    if (newOutfitPhoto) {
      const path = `outfits/${userId}/${data.id}.jpg`;
      const { error } = await supabase.storage.from("suitcase-photos").upload(path, newOutfitPhoto, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("suitcase-photos").getPublicUrl(path);
        const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;
        await supabase.from("outfits").update({ photo_url: photoUrl }).eq("id", data.id);
        data.photo_url = photoUrl;
      }
    }
    const { data: full } = await supabase.from("outfits").select("*, outfit_items(*)").eq("id", data.id).single();
    if (full) setOutfits((prev) => [...prev, full as OutfitWithItems]);
    return data.id;
  };

  const deleteOutfit = async (id: string) => {
    await supabase.from("outfits").delete().eq("id", id);
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  const addOutfitToSuitcase = async (suitcaseId: string, outfit: OutfitWithItems) => {
    const inserts = outfit.outfit_items.map((oi) => {
      const w = wardrobeItems.find((w) => w.id === oi.wardrobe_item_id);
      return {
        suitcase_id: suitcaseId,
        item_name: w?.item_name || "Item",
        category: w?.category || "other",
        wardrobe_item_id: oi.wardrobe_item_id,
        quantity: 1,
        packed: false,
      };
    });
    const { data } = await supabase.from("suitcase_items").insert(inserts).select();
    if (data) {
      setSuitcases((prev) => prev.map((s) =>
        s.id === suitcaseId ? { ...s, suitcase_items: [...s.suitcase_items, ...(data as SuitcaseItem[])] } : s
      ));
    }
  };

  const closeOutfitModal = () => {
    if (newOutfitPhotoPreview) URL.revokeObjectURL(newOutfitPhotoPreview);
    setNewOutfitName("");
    setNewOutfitPhoto(null);
    setNewOutfitPhotoPreview(null);
    setSelectedOutfitItemIds(new Set());
    setOutfitModalOpen(false);
  };

  const saveOutfitFromModal = async () => {
    await createOutfit();
    if (newOutfitPhotoPreview) URL.revokeObjectURL(newOutfitPhotoPreview);
    setNewOutfitName("");
    setNewOutfitPhoto(null);
    setNewOutfitPhotoPreview(null);
    setSelectedOutfitItemIds(new Set());
    setOutfitModalOpen(false);
  };

  // ─── Wardrobe card component (reused in panel + suitcase sliders) ───

  const renderWardrobeCard = (w: WardrobeItem, size: number, opts?: { dimmed?: boolean; onClick?: () => void; showDelete?: boolean; showPhotoBtn?: boolean }) => {
    const cat = SUITCASE_CATEGORIES.find((c) => c.value === w.category);
    const icon = cat?.icon || "📦";
    return (
      <div
        key={w.id}
        onClick={opts?.onClick}
        style={{
          width: `${size}px`, height: `${size}px`, borderRadius: "10px", flexShrink: 0,
          position: "relative", overflow: "hidden",
          border: opts?.dimmed ? `2px solid ${th.accent}` : "2px solid #e0e0e0",
          cursor: opts?.onClick ? "pointer" : "default",
          opacity: 1,
          backgroundImage: w.photo_url ? `url(${w.photo_url})` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
          background: w.photo_url ? undefined : "#f8f8f8",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: w.photo_url ? "flex-end" : "center",
        }}
      >
        {/* Already-added badge */}
        {opts?.dimmed && (
          <div style={{ position: "absolute", bottom: "2px", right: "2px", width: "16px", height: "16px", borderRadius: "50%", background: th.accent, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
            <span style={{ color: "#fff", fontSize: "9px", fontWeight: 700 }}>✓</span>
          </div>
        )}

        {/* No-photo fallback */}
        {!w.photo_url && (
          <>
            <span style={{ fontSize: `${size * 0.29}px` }}>{icon}</span>
            <span style={{ fontSize: "10px", textAlign: "center", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", opacity: 0.7 }}>{w.item_name}</span>
          </>
        )}

        {/* Photo overlay label */}
        {w.photo_url && (
          <div style={{ background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "10px", fontWeight: 600, padding: "2px 4px", position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {w.item_name}
          </div>
        )}

        {/* Photo upload button — input rendered outside overflow:hidden card via portal-style placement */}
        {opts?.showPhotoBtn && (
          <button
            onClick={(e) => { e.stopPropagation(); wardrobePhotoInputRef.current[w.id]?.click(); }}
            style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: "26px", height: "26px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, touchAction: "manipulation" }}
          >
            📷
          </button>
        )}

        {/* Delete button */}
        {opts?.showDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteWardrobeItem(w.id); }}
            style={{ position: "absolute", top: "2px", left: "2px", background: "rgba(255,255,255,0.8)", border: "none", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  // ─── Wardrobe management panel ───

  const renderWardrobePanel = () => {
    const grouped = SUITCASE_CATEGORIES
      .map((cat) => ({ ...cat, items: personWardrobe.filter((w) => (w.category || "other") === cat.value) }))
      .filter((cat) => cat.items.length > 0);

    return (
      <div className="card-glass fade-in" style={{ padding: "16px", marginBottom: "16px" }}>
        {/* Header row with title and create button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700 }}>👗 {selectedPerson}&rsquo;s Wardrobe</h4>
          <button
            onClick={() => wardrobeTab === "outfits" ? setOutfitModalOpen(true) : setWardrobeModalOpen(true)}
            className="btn btn-sm"
            style={{ background: th.accent, color: "#fff", whiteSpace: "nowrap" }}
          >
            {wardrobeTab === "outfits" ? "+ Create Outfit" : "+ Create Item"}
          </button>
        </div>

        {/* Items / Outfits tab toggle */}
        <div style={{ display: "flex", background: "#f0f0f0", borderRadius: "10px", padding: "3px", marginBottom: "14px" }}>
          <button
            onClick={() => setWardrobeTab("items")}
            style={{ flex: 1, padding: "8px", textAlign: "center", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: wardrobeTab === "items" ? "#fff" : "none", color: wardrobeTab === "items" ? "#1a1a1a" : "#777", boxShadow: wardrobeTab === "items" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            Items ({personWardrobe.length})
          </button>
          <button
            onClick={() => setWardrobeTab("outfits")}
            style={{ flex: 1, padding: "8px", textAlign: "center", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: wardrobeTab === "outfits" ? "#fff" : "none", color: wardrobeTab === "outfits" ? "#1a1a1a" : "#777", boxShadow: wardrobeTab === "outfits" ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            Outfits ({personOutfits.length})
          </button>
        </div>

        {/* Hidden file inputs for wardrobe photos — placed outside overflow:hidden cards */}
        {personWardrobe.map((w) => (
          <input
            key={`wp-${w.id}`}
            type="file"
            accept="image/*"
            ref={(el) => { wardrobePhotoInputRef.current[w.id] = el; }}
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadWardrobePhoto(w.id, f); e.target.value = ""; }}
          />
        ))}

        {wardrobeTab === "items" ? (
          <>
            {/* Wardrobe items grouped by category */}
            {grouped.length === 0 ? (
              <p style={{ opacity: 0.4, fontSize: "13px" }}>No wardrobe items yet. Add items above or they&rsquo;ll appear here as you pack suitcases.</p>
            ) : (
              grouped.map((cat) => (
                <div key={cat.value} style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>{cat.icon} {cat.label}</p>
                  <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "8px", WebkitOverflowScrolling: "touch" as const }}>
                    {cat.items.map((w) => renderWardrobeCard(w, 75, { showDelete: true, showPhotoBtn: true }))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {/* Outfits tab content */}
            {personOutfits.length === 0 ? (
              <p style={{ opacity: 0.4, fontSize: "13px" }}>No outfits yet. Create one to quickly pack a full look.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {personOutfits.map((outfit) => {
                  const outfitWardrobeItems = outfit.outfit_items.map((oi) => wardrobeItems.find((w) => w.id === oi.wardrobe_item_id)).filter(Boolean);
                  const previewItems = outfitWardrobeItems.slice(0, 5);
                  const extraCount = outfitWardrobeItems.length - 5;
                  return (
                    <div key={outfit.id} style={{ width: "140px", flexShrink: 0, borderRadius: "12px", border: "2px solid #e0e0e0", overflow: "hidden", background: "#fff", position: "relative" }}>
                      {/* Photo area */}
                      <div style={{ width: "100%", height: "90px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {outfit.photo_url ? (
                          <img src={outfit.photo_url} alt={outfit.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: "28px" }}>👗</span>
                        )}
                      </div>
                      {/* Info area */}
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{outfit.name}</div>
                        <div style={{ fontSize: "11px", opacity: 0.5 }}>{outfit.outfit_items.length} items</div>
                        {/* Mini previews */}
                        <div style={{ display: "flex", gap: "3px", marginTop: "4px" }}>
                          {previewItems.map((w, i) => {
                            const cat = SUITCASE_CATEGORIES.find((c) => c.value === w!.category);
                            return (
                              <div key={i} style={{ width: "20px", height: "20px", borderRadius: "4px", background: "#f0f0f0", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {cat?.icon || "📦"}
                              </div>
                            );
                          })}
                          {extraCount > 0 && (
                            <div style={{ width: "20px", height: "20px", borderRadius: "4px", background: "#f0f0f0", fontSize: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, opacity: 0.6 }}>
                              +{extraCount}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={() => deleteOutfit(outfit.id)}
                        style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(255,255,255,0.8)", border: "none", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─── Wardrobe slider inside a suitcase category section ───

  const renderWardrobeSlider = (suitcaseId: string, categoryValue: string) => {
    const catWardrobe = personWardrobe.filter((w) => (w.category || "other") === categoryValue);
    if (catWardrobe.length === 0) return null;

    const suitcase = suitcases.find((s) => s.id === suitcaseId);
    const suitcaseWardrobeIds = new Set(suitcase?.suitcase_items.map((i) => i.wardrobe_item_id).filter(Boolean) || []);

    return (
      <>
        <p style={{ fontSize: "11px", fontWeight: 600, opacity: 0.45, marginBottom: "4px", marginTop: "6px" }}>Pick from your wardrobe</p>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "6px", marginBottom: "4px", WebkitOverflowScrolling: "touch" as const }}>
          {catWardrobe.map((w) =>
            renderWardrobeCard(w, 65, {
              dimmed: suitcaseWardrobeIds.has(w.id),
              onClick: () => addFromWardrobe(suitcaseId, w),
            })
          )}
        </div>
      </>
    );
  };

  // ─── Category-grouped item display (Feature 4) ───

  const renderGroupedItems = (s: SuitcaseWithItems) => {
    // Group items by category
    const groups: Record<string, SuitcaseItem[]> = {};
    for (const item of s.suitcase_items) {
      const cat = item.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }

    // Render categories in defined order, then uncategorized at the bottom
    const orderedCategories = SUITCASE_CATEGORIES.filter((c) => groups[c.value] && c.value !== "other");
    const uncategorized = groups["other"] || [];

    // Categories with wardrobe items but no suitcase items yet (show slider only)
    const emptyCategories = SUITCASE_CATEGORIES.filter(
      (c) => !groups[c.value] && c.value !== "other" && personWardrobe.some((w) => (w.category || "other") === c.value)
    );

    if (s.suitcase_items.length === 0 && emptyCategories.length === 0) {
      return <p style={{ opacity: 0.4, fontSize: "13px", padding: "8px 0" }}>No items yet. Add from your wardrobe or create new items.</p>;
    }

    return (
      <>
        {orderedCategories.map((cat) => {
          const items = groups[cat.value];
          const catPacked = items.filter((i) => i.packed).length;
          const key = `${s.id}:${cat.value}`;
          const isCollapsed = collapsedCategories[key] || false;
          return (
            <div key={cat.value} style={{ marginBottom: "6px" }}>
              <div
                onClick={() => toggleCategoryCollapse(s.id, cat.value)}
                style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "6px 0", borderBottom: "1px solid #e8e8e8" }}
              >
                <span style={{ fontSize: "14px" }}>{isCollapsed ? "▸" : "▾"}</span>
                <span style={{ fontSize: "14px" }}>{cat.icon}</span>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>{cat.label}</span>
                <span style={{ opacity: 0.4, fontSize: "12px" }}>({catPacked}/{items.length} packed)</span>
              </div>
              {!isCollapsed && (
                <div className="fade-in">
                  {renderWardrobeSlider(s.id, cat.value)}
                  {items.map((item) => (
                    <SuitcaseItemRow
                      key={item.id}
                      item={item}
                      accent={th.accent}
                      onTogglePacked={() => updateItem(s.id, item.id, "packed", !item.packed)}
                      onUpdate={(field, value) => updateItem(s.id, item.id, field, value)}
                      onDelete={() => deleteItem(s.id, item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty categories that have wardrobe items — show slider only */}
        {emptyCategories.map((cat) => (
          <div key={cat.value} style={{ marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 0", borderBottom: "1px solid #e8e8e8" }}>
              <span style={{ fontSize: "14px" }}>{cat.icon}</span>
              <span style={{ fontWeight: 600, fontSize: "13px", opacity: 0.5 }}>{cat.label}</span>
            </div>
            <div style={{ paddingTop: "6px" }}>
              {renderWardrobeSlider(s.id, cat.value)}
            </div>
          </div>
        ))}

        {/* Uncategorized / Other at the bottom */}
        {uncategorized.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div
              onClick={() => toggleCategoryCollapse(s.id, "other")}
              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "6px 0", borderBottom: "1px solid #e8e8e8" }}
            >
              <span style={{ fontSize: "14px" }}>{collapsedCategories[`${s.id}:other`] ? "▸" : "▾"}</span>
              <span style={{ fontSize: "14px" }}>📦</span>
              <span style={{ fontWeight: 600, fontSize: "13px" }}>Uncategorized</span>
              <span style={{ opacity: 0.4, fontSize: "12px" }}>({uncategorized.filter((i) => i.packed).length}/{uncategorized.length} packed)</span>
            </div>
            {!collapsedCategories[`${s.id}:other`] && (
              <div className="fade-in">
                {renderWardrobeSlider(s.id, "other")}
                {uncategorized.map((item) => (
                  <SuitcaseItemRow
                    key={item.id}
                    item={item}
                    accent={th.accent}
                    onTogglePacked={() => updateItem(s.id, item.id, "packed", !item.packed)}
                    onUpdate={(field, value) => updateItem(s.id, item.id, field, value)}
                    onDelete={() => deleteItem(s.id, item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // ─── Organization photos section (Feature 2) ───

  const renderOrgPhotos = (s: SuitcaseWithItems) => {
    const photos = s.suitcase_photos || [];
    const isOpen = orgPhotosOpen[s.id] || false;

    return (
      <div style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
        <div
          onClick={() => setOrgPhotosOpen((prev) => ({ ...prev, [s.id]: !isOpen }))}
          style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
        >
          <span>{isOpen ? "▾" : "▸"}</span>
          <span>📸 Organization Photos</span>
          {photos.length > 0 && <span style={{ opacity: 0.4, fontSize: "12px" }}>({photos.length})</span>}
        </div>

        {isOpen && (
          <div className="fade-in" style={{ marginTop: "10px" }}>
            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={photo.photo_url}
                      alt={photo.label || "Organization photo"}
                      style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e0e0e0" }}
                    />
                    <button
                      onClick={() => deleteOrgPhoto(s.id, photo.id)}
                      style={{
                        position: "absolute", top: "-6px", right: "-6px",
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: "#e74c3c", color: "#fff", border: "none",
                        fontSize: "11px", fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                    {photo.label && (
                      <p style={{ fontSize: "11px", textAlign: "center", opacity: 0.6, marginTop: "4px", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {photo.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              ref={(el) => { orgPhotoInputRef.current[s.id] = el; }}
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOrgPhoto(s.id, f); e.target.value = ""; }}
            />
            <button
              onClick={() => orgPhotoInputRef.current[s.id]?.click()}
              className="btn btn-sm"
              style={{ background: "#f0f0f0", color: "#1a1a1a", fontSize: "12px" }}
            >
              📷 Add Photo
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Render helpers ───

  const renderSuitcaseCard = (s: SuitcaseWithItems) => {
    const isOpen = openId === s.id;
    const total = s.suitcase_items.length;
    const packed = packedCount(s.suitcase_items);
    return (
      <div key={s.id} className="card-glass slide-in" onClick={!isOpen ? () => setOpenId(s.id) : undefined} style={isOpen ? { position: "relative" } : { cursor: "pointer" }}>
        {/* Close button when open */}
        {isOpen && (
          <button
            onClick={() => setOpenId(null)}
            style={{ position: "absolute", top: "10px", right: "10px", background: "#f0f0f0", border: "none", borderRadius: "50%", width: "28px", height: "28px", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", zIndex: 2 }}
          >
            ✕
          </button>
        )}

        {/* Suitcase identity photo (Feature 1) */}
        {s.photo_url && (
          <div style={{ marginBottom: "10px", marginTop: "-4px" }}>
            <img
              src={s.photo_url}
              alt={s.name}
              style={{ width: "100%", maxHeight: "120px", objectFit: "cover", borderRadius: "10px" }}
            />
          </div>
        )}

        {/* Suitcase header */}
        <div onClick={() => setOpenId(isOpen ? null : s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 700, fontSize: "15px" }}>🧳 {s.name}</span>
            <span style={{ opacity: 0.5, fontSize: "12px" }}>{packed}/{total} packed</span>
            {/* Camera button for identity photo */}
            <input
              type="file"
              accept="image/*"
              ref={(el) => { suitcasePhotoInputRef.current[s.id] = el; }}
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSuitcasePhoto(s.id, f); e.target.value = ""; }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); suitcasePhotoInputRef.current[s.id]?.click(); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: "2px", opacity: 0.5 }}
              title="Set suitcase photo"
            >
              📷
            </button>
          </div>
          <span style={{ opacity: 0.3, fontSize: "18px" }}>{isOpen ? "▾" : "▸"}</span>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ height: "4px", borderRadius: "2px", background: "#f0f0f0", marginTop: "8px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(packed / total) * 100}%`, background: th.accent, borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
        )}

        {/* Items dropdown — grouped by category (Feature 4) */}
        {isOpen && (
          <div className="fade-in" style={{ marginTop: "12px" }}>
            {/* Outfit slider */}
            {personOutfits.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, opacity: 0.5, marginBottom: "8px" }}>👗 Add an outfit</p>
                <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "8px", marginBottom: "10px", WebkitOverflowScrolling: "touch" as const }}>
                  {personOutfits.map((outfit) => (
                    <div
                      key={outfit.id}
                      onClick={() => addOutfitToSuitcase(s.id, outfit)}
                      style={{ width: "120px", flexShrink: 0, borderRadius: "10px", border: "2px solid #e0e0e0", overflow: "hidden", cursor: "pointer", background: "#fff" }}
                    >
                      <div style={{ height: "60px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {outfit.photo_url ? (
                          <img src={outfit.photo_url} alt={outfit.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: "24px" }}>👗</span>
                        )}
                      </div>
                      <div style={{ padding: "6px 8px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600 }}>{outfit.name}</div>
                        <div style={{ fontSize: "10px", opacity: 0.5 }}>{outfit.outfit_items.length} items</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {renderGroupedItems(s)}
            <button onClick={() => addItem(s.id)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a", marginTop: "8px" }}>+ New Item</button>

            {/* Organization photos (Feature 2) */}
            {renderOrgPhotos(s)}

            {/* Footer actions */}
            <div style={{ marginTop: "14px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
              {confirmDeleteId === s.id ? (
                <div className="fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", color: "#e74c3c", fontWeight: 600 }}>Delete this suitcase and all its items?</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setConfirmDeleteId(null)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Cancel</button>
                    <button onClick={() => { deleteSuitcase(s.id); setConfirmDeleteId(null); }} className="btn btn-sm" style={{ background: "#e74c3c" }}>Yes, Delete</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => saveAsTemplate(s)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a", fontSize: "11px" }}>📋 Save as Template</button>
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "13px", opacity: 0.6, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.6"; }}
                  >
                    🗑 Delete Suitcase
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: tripId ? "0" : "16px 16px" }}>
        {/* Person selector */}
        {uniqueMembers.length === 0 ? (
          <div className="card-glass" style={{ padding: "32px", textAlign: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>👨‍👩‍👧‍👦</div>
            <p style={{ opacity: 0.5, fontSize: "14px", marginBottom: "12px" }}>No family members found. Create a family profile first.</p>
            {!tripId && (
              <button onClick={() => router.push("/profile")} className="btn" style={{ background: th.accent }}>Create Family Profile →</button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: "20px" }}>
            {!tripId && <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "10px" }}>👤 Select a Person</h3>}
            <MemberSlider
              members={uniqueMembers}
              selectedName={selectedPerson}
              onSelect={(name) => { setSelectedPerson(name); setOpenId(null); setWardrobeMode(false); }}
              badge={(name) => packedCountFor(name) || countFor(name) || null}
            />
          </div>
        )}

        {/* Selected person's suitcases */}
        {selectedPerson && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700 }}>
                {(() => { const mem = uniqueMembers.find((m) => m.name === selectedPerson); return mem?.avatar_url ? <img src={mem.avatar_url} alt={mem.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", display: "inline-block", verticalAlign: "middle" }} /> : ageIcon(mem?.age_type || "adult"); })()} {selectedPerson}&rsquo;s Suitcases
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => { setWardrobeMode(!wardrobeMode); }} className="btn btn-sm" style={{ background: wardrobeMode ? th.accent : "#f0f0f0", color: wardrobeMode ? "#fff" : "#1a1a1a" }}>👗 Wardrobe ({personWardrobe.length})</button>
                <button onClick={() => setShowTemplates(!showTemplates)} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>📋 Templates</button>
              </div>
            </div>

            {/* Wardrobe panel */}
            {wardrobeMode && renderWardrobePanel()}

            {/* Templates drawer */}
            {showTemplates && (
              <div className="card-glass fade-in" style={{ padding: "16px", marginBottom: "16px", borderColor: th.accent }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>📋 Load a Template for {selectedPerson}</h4>
                {templates.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: "13px" }}>No templates yet. Save a suitcase as a template to reuse it.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {templates.map((t) => (
                      <div key={t.id} className="card-glass" style={{ padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          <span style={{ opacity: 0.5, fontSize: "12px", marginLeft: "8px" }}>{t.suitcase_items.length} items</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => loadFromTemplate(t)} className="btn btn-sm" style={{ background: th.accent }}>Use for {selectedPerson}</button>
                          <button onClick={() => deleteSuitcase(t.id)} className="btn btn-sm" style={{ background: "#e74c3c" }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Create suitcase for this person */}
            <div className="card-glass" style={{ padding: "14px", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input value={newSuitcaseName} onChange={(e) => setNewSuitcaseName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createSuitcase()} placeholder="Suitcase name (e.g., Carry-on, Checked Bag)" className="input-modern" style={{ flex: 1, minWidth: "160px" }} />
              <button onClick={createSuitcase} className="btn" style={{ background: th.accent, whiteSpace: "nowrap" }}>+ Add Suitcase</button>
            </div>

            {/* Suitcase list */}
            {personSuitcases.length === 0 ? (
              <div className="card-glass" style={{ padding: "36px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🧳</div>
                <p style={{ opacity: 0.5, fontSize: "14px" }}>No suitcases for {selectedPerson} yet. Create one above or load a template.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {personSuitcases.map(renderSuitcaseCard)}
              </div>
            )}
          </div>
        )}

        {/* When no person selected, show overview */}
        {!selectedPerson && uniqueMembers.length > 0 && (
          <div className="card-glass" style={{ padding: "36px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>👆</div>
            <p style={{ opacity: 0.5, fontSize: "14px" }}>Select a family member above to manage their suitcases.</p>
          </div>
        )}
      </div>

      {/* ─── Wardrobe Item Creation Modal ─── */}
      {wardrobeModalOpen && (
        <div
          onClick={closeWardrobeModal}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "400px" }}>
            <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Add to Wardrobe</h4>
            {/* Photo upload zone */}
            <div
              onClick={() => wardrobeModalPhotoRef.current?.click()}
              style={{ width: "100%", height: "160px", borderRadius: "12px", border: "2px dashed #ddd", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fafafa", marginBottom: "14px", overflow: "hidden" }}
            >
              {newWardrobePhotoPreview ? (
                <img src={newWardrobePhotoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <span style={{ fontSize: "32px" }}>📷</span>
                  <span style={{ fontSize: "13px", opacity: 0.5, marginTop: "6px" }}>Tap to add photo</span>
                </>
              )}
            </div>
            <input
              ref={wardrobeModalPhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setNewWardrobePhoto(f);
                  setNewWardrobePhotoPreview(URL.createObjectURL(f));
                }
                e.target.value = "";
              }}
            />
            <input
              value={newWardrobeName}
              onChange={(e) => setNewWardrobeName(e.target.value)}
              placeholder="Item name (e.g., Blue Polo)"
              className="input-modern"
              style={{ width: "100%", marginBottom: "10px", boxSizing: "border-box" }}
            />
            <select
              value={newWardrobeCat}
              onChange={(e) => setNewWardrobeCat(e.target.value)}
              className="input-modern"
              style={{ width: "100%", marginBottom: "16px", boxSizing: "border-box" }}
            >
              {SUITCASE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={closeWardrobeModal} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Cancel</button>
              <button onClick={saveWardrobeFromModal} className="btn btn-sm" style={{ background: th.accent }} disabled={!newWardrobeName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Outfit Creation Modal ─── */}
      {outfitModalOpen && (
        <div
          onClick={closeOutfitModal}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "400px", maxHeight: "80vh", overflowY: "auto" }}>
            <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Create Outfit</h4>
            {/* Photo upload zone */}
            <div
              onClick={() => outfitModalPhotoRef.current?.click()}
              style={{ width: "100%", height: "120px", borderRadius: "12px", border: "2px dashed #ddd", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fafafa", marginBottom: "14px", overflow: "hidden" }}
            >
              {newOutfitPhotoPreview ? (
                <img src={newOutfitPhotoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <span style={{ fontSize: "32px" }}>📷</span>
                  <span style={{ fontSize: "13px", opacity: 0.5, marginTop: "6px" }}>Tap to add photo</span>
                </>
              )}
            </div>
            <input
              ref={outfitModalPhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setNewOutfitPhoto(f);
                  setNewOutfitPhotoPreview(URL.createObjectURL(f));
                }
                e.target.value = "";
              }}
            />
            <input
              value={newOutfitName}
              onChange={(e) => setNewOutfitName(e.target.value)}
              placeholder="Outfit name (e.g., Beach Day)"
              className="input-modern"
              style={{ width: "100%", marginBottom: "10px", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", marginTop: "4px" }}>Select items:</p>
            {/* Person's wardrobe items grouped by category as a checklist */}
            {SUITCASE_CATEGORIES
              .map((cat) => ({ ...cat, items: personWardrobe.filter((w) => (w.category || "other") === cat.value) }))
              .filter((cat) => cat.items.length > 0)
              .map((cat) => (
                <div key={cat.value} style={{ marginBottom: "10px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, opacity: 0.5, marginBottom: "4px" }}>{cat.icon} {cat.label}</p>
                  {cat.items.map((w) => {
                    const isSelected = selectedOutfitItemIds.has(w.id);
                    return (
                      <div
                        key={w.id}
                        onClick={() => {
                          setSelectedOutfitItemIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                            return next;
                          });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", cursor: "pointer" }}
                      >
                        <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: `2px solid ${isSelected ? th.accent : "#ddd"}`, background: isSelected ? th.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isSelected && <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: "13px" }}>{w.item_name}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button onClick={closeOutfitModal} className="btn btn-sm" style={{ background: "#f0f0f0", color: "#1a1a1a" }}>Cancel</button>
              <button
                onClick={saveOutfitFromModal}
                className="btn btn-sm"
                style={{ background: th.accent }}
                disabled={!newOutfitName.trim() || selectedOutfitItemIds.size === 0}
              >
                Save Outfit ({selectedOutfitItemIds.size} items)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
