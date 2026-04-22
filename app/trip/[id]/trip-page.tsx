"use client";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { TRIP_TYPES, THEMES, BOOKING_TYPES } from "@/lib/constants";
import { tripKeys } from "@/lib/query-keys";
import { generateDays, formatDate } from "@/lib/utils";

import { usePlacesAutocomplete } from "@/lib/use-places-autocomplete";
import { useItineraryLocations } from "@/lib/use-itinerary-locations";
import { logActivity } from "@/lib/trip-activity";
import type { Trip, TripBooking, ItineraryEvent } from "@/types/database.types";
import TripSubNav from "./trip-sub-nav";
import WeatherCard from "./weather-card";
import RoleHero, { type RoleHeroData } from "./role-hero";
import { useTripData } from "./trip-data-context";

// Re-export so server `page.tsx` can import RoleHeroData through its client
// boundary without reaching directly into role-hero.tsx. Keeps the hero
// payload shape owned by one file while the server page stays wired to the
// client page it renders.
export type { RoleHeroData };

export interface TripPageProps {
  userName: string;
  needsSetup: boolean;
  memberCount: number;
  bookings: TripBooking[];
  /** Current viewer's trip_members.role_preference — drives sub-nav order + hero variant. */
  currentUserRole: string | null;
  /** Earliest upcoming itinerary event (date >= today), or null if nothing scheduled. */
  nextEvent: ItineraryEvent | null;
  /** Up to 3 upcoming events (date >= today). Fed to the All In "Quick scan" row. */
  upcomingEvents: ItineraryEvent[];
  /** Pre-computed hero data (balances, unread chat, packing %, latest message). */
  heroData: RoleHeroData;
}

// ─── Booking helpers ───

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function bookingIcon(type: string) {
  return BOOKING_TYPES.find((b) => b.value === type)?.icon || "📋";
}

function bookingLabel(type: string) {
  return BOOKING_TYPES.find((b) => b.value === type)?.label || type;
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div>
      <span style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: "uppercase" }}>{label}</span>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
    </div>
  );
}

function LocationRow({ address, accent }: { address: string; accent: string }) {
  return (
    <a
      href={`https://www.google.com/maps/search/${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        background: `${accent}08`, border: `1px solid ${accent}15`, borderRadius: 10,
        padding: "10px 14px", marginTop: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>📍 {address}</div>
      <div style={{ fontSize: 11, color: accent, marginTop: 2 }}>Tap to open in Maps ↗</div>
    </a>
  );
}

function NotesRow({ notes }: { notes: string }) {
  return (
    <div style={{
      background: "#fff8e1", border: "1px solid #ffe0826e", borderRadius: 10,
      padding: "10px 14px", marginTop: 8, fontSize: 13,
    }}>
      📌 {notes}
    </div>
  );
}

// ─── Location Suggestions (from itinerary events) ───

function LocationSuggestions({
  locations,
  accent,
  muted,
  cardBorder,
  onSelect,
}: {
  locations: string[];
  accent: string;
  muted: string;
  cardBorder: string;
  onSelect: (loc: string) => void;
}) {
  if (locations.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: muted, fontWeight: 600, alignSelf: "center" }}>
        From itinerary:
      </span>
      {locations.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onSelect(loc)}
          style={{
            padding: "4px 10px",
            borderRadius: 14,
            border: `1px solid ${cardBorder}`,
            background: `${accent}12`,
            color: accent,
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={loc}
        >
          📍 {loc}
        </button>
      ))}
    </div>
  );
}

// ─── Add Booking Form (Hub version with Places Autocomplete) ───

interface BookingFormHubProps {
  tripId: string;
  userId: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  muted: string;
  text: string;
  onAdded: (booking: TripBooking) => void;
  onCancel: () => void;
}

function AddBookingFormHub({ tripId, userId, accent, cardBg, cardBorder, muted, text, onAdded, onCancel }: BookingFormHubProps) {
  const supabase = createBrowserSupabaseClient();
  const [type, setType] = useState<string>("flight");
  const [saving, setSaving] = useState(false);
  const itineraryLocations = useItineraryLocations(tripId);

  const [providerName, setProviderName] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  // Flight
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [terminal, setTerminal] = useState("");
  const [seatInfo, setSeatInfo] = useState("");

  // Hotel
  const [address, setAddress] = useState("");
  const [roomType, setRoomType] = useState("");

  // Car
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [carType, setCarType] = useState("");

  // Restaurant
  const [partySize, setPartySize] = useState("");

  // Places Autocomplete refs
  const hotelAddressRef = usePlacesAutocomplete((place) => setAddress(place), {});
  const restaurantAddressRef = usePlacesAutocomplete((place) => setAddress(place), {});
  const pickupRef = usePlacesAutocomplete((place) => setPickupLocation(place), {});
  const dropoffRef = usePlacesAutocomplete((place) => setDropoffLocation(place), {});

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${cardBorder}`,
    background: cardBg, color: text, fontFamily: "'DM Sans', sans-serif", fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase" as const, marginBottom: 4, display: "block" };
  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    const payload: any = {
      trip_id: tripId, added_by: userId, booking_type: type,
      provider_name: providerName || null, confirmation_number: confirmationNumber || null,
      start_date: startDate || null, end_date: endDate || null,
      start_time: startTime || null, end_time: endTime || null,
      cost: cost ? parseFloat(cost) : null, notes: notes || null,
    };

    if (type === "flight") {
      Object.assign(payload, {
        airline: airline || null, flight_number: flightNumber || null,
        departure_airport: departureAirport || null, arrival_airport: arrivalAirport || null,
        terminal: terminal || null, seat_info: seatInfo || null,
      });
    } else if (type === "hotel") {
      Object.assign(payload, { address: address || null, room_type: roomType || null });
    } else if (type === "car_rental") {
      Object.assign(payload, {
        pickup_location: pickupLocation || null, dropoff_location: dropoffLocation || null,
        car_type: carType || null,
      });
    } else if (type === "restaurant") {
      Object.assign(payload, { party_size: partySize ? parseInt(partySize, 10) : null, address: address || null });
    }

    const { error } = await supabase.from("trip_bookings").insert(payload);
    if (error) { console.error("Booking insert error:", JSON.stringify(error, null, 2)); setSaving(false); return; }

    const localBooking: TripBooking = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    onAdded(localBooking);
    setSaving(false);
  };

  return (
    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 16px" }}>Add Booking</h3>

      {/* Type selector pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {BOOKING_TYPES.map((bt) => (
          <button key={bt.value} onClick={() => setType(bt.value)} style={{
            padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${type === bt.value ? accent : cardBorder}`,
            background: type === bt.value ? `${accent}1a` : "transparent",
            color: type === bt.value ? accent : muted, fontWeight: type === bt.value ? 700 : 500,
            fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>
            {bt.icon} {bt.label}
          </button>
        ))}
      </div>

      {/* Common: provider + confirmation */}
      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>{type === "flight" ? "Airline" : type === "hotel" ? "Hotel Name" : type === "car_rental" ? "Rental Company" : "Restaurant Name"}</label>
          <input style={inputStyle} value={type === "flight" ? airline : providerName} onChange={(e) => type === "flight" ? setAirline(e.target.value) : setProviderName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Confirmation #</label>
          <input style={inputStyle} value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="e.g. ABC123" />
        </div>
      </div>

      {/* Type-specific fields */}
      {type === "flight" && (
        <>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Flight Number</label><input style={inputStyle} value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="e.g. UA 1234" /></div>
            <div><label style={labelStyle}>Seat</label><input style={inputStyle} value={seatInfo} onChange={(e) => setSeatInfo(e.target.value)} placeholder="e.g. 12A" /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Departure Airport</label><input style={inputStyle} value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} placeholder="e.g. LAX" /></div>
            <div><label style={labelStyle}>Arrival Airport</label><input style={inputStyle} value={arrivalAirport} onChange={(e) => setArrivalAirport(e.target.value)} placeholder="e.g. BNA" /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Terminal</label><input style={inputStyle} value={terminal} onChange={(e) => setTerminal(e.target.value)} /></div>
            <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Departure Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Arrival Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
        </>
      )}

      {type === "hotel" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setAddress} />
            <input ref={hotelAddressRef} style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Check-in Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Check-out Date</label><input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Check-in Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Check-out Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Room Type</label><input style={inputStyle} value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="e.g. King Suite" /></div>
        </>
      )}

      {type === "car_rental" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Pickup Location</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setPickupLocation} />
            <input ref={pickupRef} style={inputStyle} value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Dropoff Location</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setDropoffLocation} />
            <input ref={dropoffRef} style={inputStyle} value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Pickup Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Dropoff Date</label><input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Pickup Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Dropoff Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Vehicle Type</label><input style={inputStyle} value={carType} onChange={(e) => setCarType(e.target.value)} placeholder="e.g. SUV, Sedan" /></div>
        </>
      )}

      {type === "restaurant" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setAddress} />
            <input ref={restaurantAddressRef} style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Party Size</label><input type="number" style={{ ...inputStyle, width: 100 }} value={partySize} onChange={(e) => setPartySize(e.target.value)} min={1} /></div>
        </>
      )}

      {/* Common: cost + notes */}
      <div style={rowStyle}>
        <div><label style={labelStyle}>Cost ($)</label><input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate codes, contact info..." /></div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onCancel} style={{
          padding: "10px 20px", borderRadius: 10, border: `1px solid ${cardBorder}`,
          background: "transparent", color: muted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn" style={{
          background: accent, padding: "10px 24px", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1,
        }}>{saving ? "Saving..." : "Save Booking"}</button>
      </div>
    </div>
  );
}

// ─── Edit Booking Form (Hub version with Places Autocomplete) ───

interface EditBookingFormHubProps {
  booking: TripBooking;
  tripId: string;
  userId: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  muted: string;
  text: string;
  onEdited: (booking: TripBooking) => void;
  onCancel: () => void;
}

function EditBookingFormHub({ booking, tripId, userId, accent, cardBg, cardBorder, muted, text, onEdited, onCancel }: EditBookingFormHubProps) {
  const supabase = createBrowserSupabaseClient();
  const [saving, setSaving] = useState(false);
  const type = booking.booking_type;
  const itineraryLocations = useItineraryLocations(tripId);

  const [providerName, setProviderName] = useState(booking.provider_name || "");
  const [confirmationNumber, setConfirmationNumber] = useState(booking.confirmation_number || "");
  const [startDate, setStartDate] = useState(booking.start_date || "");
  const [endDate, setEndDate] = useState(booking.end_date || "");
  const [startTime, setStartTime] = useState(booking.start_time || "");
  const [endTime, setEndTime] = useState(booking.end_time || "");
  const [cost, setCost] = useState(booking.cost ? String(booking.cost) : "");
  const [notes, setNotes] = useState(booking.notes || "");

  const [airline, setAirline] = useState(booking.airline || "");
  const [flightNumber, setFlightNumber] = useState(booking.flight_number || "");
  const [departureAirport, setDepartureAirport] = useState(booking.departure_airport || "");
  const [arrivalAirport, setArrivalAirport] = useState(booking.arrival_airport || "");
  const [terminal, setTerminal] = useState(booking.terminal || "");
  const [seatInfo, setSeatInfo] = useState(booking.seat_info || "");

  const [address, setAddress] = useState(booking.address || "");
  const [roomType, setRoomType] = useState(booking.room_type || "");

  const [pickupLocation, setPickupLocation] = useState(booking.pickup_location || "");
  const [dropoffLocation, setDropoffLocation] = useState(booking.dropoff_location || "");
  const [carType, setCarType] = useState(booking.car_type || "");

  const [partySize, setPartySize] = useState(booking.party_size ? String(booking.party_size) : "");

  const hotelAddressRef = usePlacesAutocomplete((place) => setAddress(place), {});
  const restaurantAddressRef = usePlacesAutocomplete((place) => setAddress(place), {});
  const pickupRef = usePlacesAutocomplete((place) => setPickupLocation(place), {});
  const dropoffRef = usePlacesAutocomplete((place) => setDropoffLocation(place), {});

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${cardBorder}`,
    background: cardBg, color: text, fontFamily: "'DM Sans', sans-serif", fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase" as const, marginBottom: 4, display: "block" };
  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    const payload: any = {
      provider_name: providerName || null, confirmation_number: confirmationNumber || null,
      start_date: startDate || null, end_date: endDate || null,
      start_time: startTime || null, end_time: endTime || null,
      cost: cost ? parseFloat(cost) : null, notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (type === "flight") {
      Object.assign(payload, {
        airline: airline || null, flight_number: flightNumber || null,
        departure_airport: departureAirport || null, arrival_airport: arrivalAirport || null,
        terminal: terminal || null, seat_info: seatInfo || null,
      });
    } else if (type === "hotel") {
      Object.assign(payload, { address: address || null, room_type: roomType || null });
    } else if (type === "car_rental") {
      Object.assign(payload, {
        pickup_location: pickupLocation || null, dropoff_location: dropoffLocation || null,
        car_type: carType || null,
      });
    } else if (type === "restaurant") {
      Object.assign(payload, { party_size: partySize ? parseInt(partySize, 10) : null, address: address || null });
    }

    const { error } = await supabase.from("trip_bookings").update(payload).eq("id", booking.id);
    if (error) { console.error("Booking update error:", JSON.stringify(error, null, 2)); setSaving(false); return; }

    onEdited({ ...booking, ...payload });
    setSaving(false);
  };

  return (
    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 16px" }}>
        Edit {bookingIcon(type)} {bookingLabel(type)}
      </h3>

      {/* Common: provider + confirmation */}
      <div style={rowStyle}>
        <div>
          <label style={labelStyle}>{type === "flight" ? "Airline" : type === "hotel" ? "Hotel Name" : type === "car_rental" ? "Rental Company" : "Restaurant Name"}</label>
          <input style={inputStyle} value={type === "flight" ? airline : providerName} onChange={(e) => type === "flight" ? setAirline(e.target.value) : setProviderName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Confirmation #</label>
          <input style={inputStyle} value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} />
        </div>
      </div>

      {type === "flight" && (
        <>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Flight Number</label><input style={inputStyle} value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} /></div>
            <div><label style={labelStyle}>Seat</label><input style={inputStyle} value={seatInfo} onChange={(e) => setSeatInfo(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Departure Airport</label><input style={inputStyle} value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} /></div>
            <div><label style={labelStyle}>Arrival Airport</label><input style={inputStyle} value={arrivalAirport} onChange={(e) => setArrivalAirport(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Terminal</label><input style={inputStyle} value={terminal} onChange={(e) => setTerminal(e.target.value)} /></div>
            <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Departure Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Arrival Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
        </>
      )}

      {type === "hotel" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setAddress} />
            <input ref={hotelAddressRef} style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Check-in Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Check-out Date</label><input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Check-in Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Check-out Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Room Type</label><input style={inputStyle} value={roomType} onChange={(e) => setRoomType(e.target.value)} /></div>
        </>
      )}

      {type === "car_rental" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Pickup Location</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setPickupLocation} />
            <input ref={pickupRef} style={inputStyle} value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Dropoff Location</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setDropoffLocation} />
            <input ref={dropoffRef} style={inputStyle} value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Pickup Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Dropoff Date</label><input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Pickup Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={labelStyle}>Dropoff Time</label><input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Vehicle Type</label><input style={inputStyle} value={carType} onChange={(e) => setCarType(e.target.value)} /></div>
        </>
      )}

      {type === "restaurant" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Address</label>
            <LocationSuggestions locations={itineraryLocations} accent={accent} muted={muted} cardBorder={cardBorder} onSelect={setAddress} />
            <input ref={restaurantAddressRef} style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>Time</label><input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Party Size</label><input type="number" style={{ ...inputStyle, width: 100 }} value={partySize} onChange={(e) => setPartySize(e.target.value)} min={1} /></div>
        </>
      )}

      <div style={rowStyle}>
        <div><label style={labelStyle}>Cost ($)</label><input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate codes, contact info..." /></div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onCancel} style={{
          padding: "10px 20px", borderRadius: 10, border: `1px solid ${cardBorder}`,
          background: "transparent", color: muted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn" style={{
          background: accent, padding: "10px 24px", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1,
        }}>{saving ? "Saving..." : "Save Changes"}</button>
      </div>
    </div>
  );
}

export default function TripPage({
  userName,
  needsSetup,
  memberCount,
  bookings: initialBookings,
  currentUserRole,
  nextEvent,
  upcomingEvents,
  heroData,
}: TripPageProps) {
  const { trip: initialTrip, userId, isHost, members } = useTripData();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const id = initialTrip.id;

  const [trip, setTrip] = useState<Trip>(initialTrip);

  // ─── Bookings state (TanStack Query) ───
  const queryClient = useQueryClient();
  const { data: bookings = [] } = useQuery({
    queryKey: tripKeys.bookings(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_bookings").select("*").eq("trip_id", id).order("created_at");
      if (error) throw error;
      return (data ?? []) as TripBooking[];
    },
    initialData: initialBookings,
    staleTime: 30_000,
  });
  // Local cache-setter wrapper so existing patch sites keep working.
  const setBookings = (updater: TripBooking[] | ((prev: TripBooking[]) => TripBooking[])) => {
    queryClient.setQueryData<TripBooking[]>(tripKeys.bookings(id), (prev) => {
      const current = prev ?? [];
      return typeof updater === "function"
        ? (updater as (prev: TripBooking[]) => TripBooking[])(current)
        : updater;
    });
  };
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<string | null>(null);
  const [collapsedTypes, setCollapsedTypes] = useState<Record<string, boolean>>({});
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);

  // Vibes Only role: the whole Travel & Lodging section starts collapsed so
  // the hub stays calm — the feature isn't hidden (memory:
  // role_density_no_feature_loss.md), tapping the header expands the full
  // list. All other roles keep the default expanded behavior.
  const [lodgingCollapsed, setLodgingCollapsed] = useState<boolean>(
    currentUserRole === "vibes_only"
  );

  // Member name lookup
  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => { if (m.user_id) map[m.user_id] = m.name; });
    return map;
  }, [members]);

  // Group bookings by type
  const bookingsByType = useMemo(() => {
    const grouped: Record<string, TripBooking[]> = {};
    for (const bt of BOOKING_TYPES) {
      const items = bookings.filter((b) => b.booking_type === bt.value);
      if (items.length > 0) grouped[bt.value] = items;
    }
    return grouped;
  }, [bookings]);

  // Booking CRUD
  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("trip_bookings").delete().eq("id", bookingId);
      if (error) throw error;
      return bookingId;
    },
    onSuccess: (bookingId) => {
      const booking = bookings.find((b) => b.id === bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      setConfirmDeleteBookingId(null);
      setExpandedBookingId(null);
      if (booking) {
        logActivity(supabase, {
          tripId: id, userId, userName, action: "deleted", entityType: "booking",
          entityName: booking.provider_name || bookingLabel(booking.booking_type),
          linkPath: `/trip/${id}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: tripKeys.bookings(id) });
    },
    onError: (error) => {
      console.error("deleteBooking error:", error);
    },
  });
  const handleDeleteBooking = useCallback((bookingId: string) => {
    deleteBookingMutation.mutate(bookingId);
  }, [deleteBookingMutation]);

  const handleBookingAdded = useCallback((booking: TripBooking) => {
    setBookings((prev) => [...prev, booking]);
    setShowBookingForm(false);
    logActivity(supabase, {
      tripId: id, userId, userName, action: "added", entityType: "booking",
      entityName: booking.provider_name || bookingLabel(booking.booking_type),
      entityId: booking.id,
      linkPath: `/trip/${id}`,
    });
    queryClient.invalidateQueries({ queryKey: tripKeys.bookings(id) });
  }, [supabase, id, userId, userName, queryClient]);

  const handleBookingEdited = useCallback((updated: TripBooking) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    setEditingBookingId(null);
    logActivity(supabase, {
      tripId: id, userId, userName, action: "edited", entityType: "booking",
      entityName: updated.provider_name || bookingLabel(updated.booking_type),
      entityId: updated.id,
      linkPath: `/trip/${id}`,
    });
    queryClient.invalidateQueries({ queryKey: tripKeys.bookings(id) });
  }, [supabase, id, userId, userName, queryClient]);

  const toggleTypeCollapse = useCallback((type: string) => {
    setCollapsedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Local state for text inputs — updates instantly, saves debounced
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateTrip = useCallback((field: string, value: string) => {
    setTrip((t) => ({ ...t, [field]: value }));
    if (saveTimers.current[field]) clearTimeout(saveTimers.current[field]);
    saveTimers.current[field] = setTimeout(async () => {
      await supabase.from("trips").update({ [field]: value }).eq("id", id);
    }, 600);
  }, [id, supabase]);

  // Flush pending saves before navigating away
  const flushSaves = useCallback(async () => {
    const pending = Object.entries(saveTimers.current);
    pending.forEach(([, timer]) => clearTimeout(timer));
    saveTimers.current = {};
    if (pending.length > 0) {
      await supabase.from("trips").update({
        name: trip.name,
        location: trip.location,
        notes: trip.notes,
        start_date: trip.start_date,
        end_date: trip.end_date,
      }).eq("id", id);
      const changedFields = pending.map(([field]) => field).join(", ");
      logActivity(supabase, { tripId: id, userId, userName, action: "updated", entityType: "trip", entityName: trip.name, detail: `Changed: ${changedFields}`, linkPath: `/trip/${id}` });
    }
  }, [trip, id, supabase, userId, userName]);

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Google Places Autocomplete for location field (cities only)
  const locationRef = usePlacesAutocomplete((place) => {
    updateTrip("location", place);
  });

  const days = useMemo(() => generateDays(trip?.start_date, trip?.end_date), [trip?.start_date, trip?.end_date]);

  const tt = TRIP_TYPES.find((t) => t.value === trip.trip_type) || TRIP_TYPES[0];
  const th = THEMES[trip.trip_type] || THEMES.camping;

  const handleNext = async () => {
    await flushSaves();
    router.push(`/trip/${id}/group`);
  };

  // ─── Hub view: trip is set up, show overview + sub-nav ───
  if (!needsSetup) {
    return (
      <div style={{ color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}

        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: `1px solid ${th.cardBorder}`,
          }}
        >
          <div style={{ background: th.headerBg, padding: "14px 20px", backdropFilter: "blur(20px)", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => router.push("/dashboard")}
                aria-label="Back to dashboard"
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
                  flexShrink: 0,
                }}
              >
                ←
              </button>
              <div style={{ marginLeft: 4 }}>
                <div style={{ color: th.text, fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 800 }}>
                  {trip.name}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.5 }}>
                  {trip.location && `📍 ${trip.location}`}
                  {trip.location && days.length > 0 && " · "}
                  {days.length > 0 && `${formatDate(days[0])} — ${formatDate(days[days.length - 1])}`}
                  {memberCount > 0 && ` · ${memberCount} ${memberCount === 1 ? "person" : "people"}`}
                </div>
              </div>
            </div>
            {isHost && (
              <button
                onClick={() => router.push(`/trip/${id}?edit=true`)}
                style={{ background: "none", border: `1.5px solid ${th.cardBorder}`, borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", color: th.muted, fontFamily: "'DM Sans', sans-serif", minHeight: "44px", minWidth: "44px" }}
              >
                ✏️ Edit Details
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "16px", paddingBottom: "80px", maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Role-specific hero addendum — renders below the existing trip
              header. Respects the "nothing disappears" rule: this is an ADD,
              not a replacement. See lib/role-density.ts + role-hero.tsx. */}
          <RoleHero
            role={currentUserRole}
            trip={trip}
            theme={th}
            nextEvent={nextEvent}
            upcomingEvents={upcomingEvents}
            isHost={isHost}
            heroData={heroData}
          />

          {/* Weather Forecast */}
          <WeatherCard location={trip.location} startDate={trip.start_date} endDate={trip.end_date} theme={th} />

          {/* ─── Travel & Lodging Section ─── */}
          <div className="fade-in" style={{ marginTop: 24 }}>
            {/* Header doubles as a tap-to-expand toggle. For Vibes Only the
                body starts collapsed so the hub reads as calm; all other
                roles start expanded and the toggle is a small UX gain. */}
            <div
              onClick={() => setLodgingCollapsed((v) => !v)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: lodgingCollapsed ? 0 : 16,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>
                🧳 Travel & Lodging
                {lodgingCollapsed && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: th.muted, marginLeft: 8 }}>
                    · tap to expand
                  </span>
                )}
              </h3>
              <span style={{ fontSize: 14, color: th.muted }}>
                {lodgingCollapsed ? "▸" : "▾"}
              </span>
            </div>

            {/* Bookings grouped by type — collapsible */}
            {!lodgingCollapsed && Object.keys(bookingsByType).length > 0 ? (
              Object.entries(bookingsByType).map(([type, items]) => {
                const isCollapsed = collapsedTypes[type] ?? false;
                return (
                  <div key={type} style={{ marginBottom: 20 }}>
                    <div
                      onClick={() => toggleTypeCollapse(type)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: isCollapsed ? 0 : 10,
                        cursor: "pointer", userSelect: "none",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{bookingIcon(type)}</span>
                      <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, margin: 0 }}>
                        {bookingLabel(type)}s
                      </h4>
                      <span style={{
                        fontSize: 11, color: th.muted, background: `${th.accent}18`,
                        padding: "2px 8px", borderRadius: 12, fontWeight: 600,
                      }}>
                        {items.length}
                      </span>
                      <span style={{ fontSize: 12, color: th.muted, marginLeft: "auto" }}>
                        {isCollapsed ? "▸" : "▾"}
                      </span>
                    </div>

                    {!isCollapsed && items.map((b) => {
                      const isExpanded = expandedBookingId === b.id;
                      const canEdit = b.added_by === userId || isHost;
                      const headline = b.booking_type === "flight"
                        ? `${b.airline || ""} ${b.flight_number || ""}`.trim() || b.provider_name || "Flight"
                        : b.provider_name || bookingLabel(b.booking_type);
                      const subtitle = b.booking_type === "flight"
                        ? `${b.departure_airport || "?"} → ${b.arrival_airport || "?"}`
                        : b.booking_type === "car_rental"
                        ? `${b.pickup_location || "?"} → ${b.dropoff_location || b.pickup_location || "?"}`
                        : b.address || "";
                      const dateStr = b.booking_type === "hotel" || b.booking_type === "car_rental"
                        ? `${fmtDate(b.start_date)}${b.end_date ? ` — ${fmtDate(b.end_date)}` : ""}`
                        : `${fmtDate(b.start_date)}${b.start_time ? ` at ${fmtTime(b.start_time)}` : ""}`;

                      return (
                        <div
                          key={b.id}
                          style={{
                            background: th.card, border: `1px solid ${th.cardBorder}`, borderRadius: 14,
                            padding: "16px 18px", marginBottom: 10, cursor: "pointer",
                            borderLeft: `4px solid ${th.accent}`,
                          }}
                          onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                        >
                          {/* Top row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 20 }}>{bookingIcon(b.booking_type)}</span>
                                <span style={{ fontWeight: 700, fontSize: 15 }}>{headline}</span>
                              </div>
                              {subtitle && <div style={{ fontSize: 13, color: th.muted, marginBottom: 2 }}>{subtitle}</div>}
                              <div style={{ fontSize: 12, color: th.muted }}>{dateStr}</div>
                            </div>
                            {b.confirmation_number && (
                              <div style={{
                                background: `${th.accent}15`, border: `1px solid ${th.accent}40`, borderRadius: 8,
                                padding: "6px 12px", textAlign: "center", flexShrink: 0,
                              }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: th.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirmation</div>
                                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', monospace", color: th.accent, letterSpacing: "0.03em" }}>
                                  {b.confirmation_number}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${th.cardBorder}`, fontSize: 13 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                                {b.booking_type === "flight" && (
                                  <>
                                    {b.terminal && <DetailRow label="Terminal" value={b.terminal} muted={th.muted} />}
                                    {b.seat_info && <DetailRow label="Seat" value={b.seat_info} muted={th.muted} />}
                                    {b.start_time && <DetailRow label="Departs" value={fmtTime(b.start_time)} muted={th.muted} />}
                                    {b.end_time && <DetailRow label="Arrives" value={fmtTime(b.end_time)} muted={th.muted} />}
                                    {b.departure_airport && <DetailRow label="From" value={b.departure_airport} muted={th.muted} />}
                                    {b.arrival_airport && <DetailRow label="To" value={b.arrival_airport} muted={th.muted} />}
                                  </>
                                )}
                                {b.booking_type === "hotel" && (
                                  <>
                                    {b.room_type && <DetailRow label="Room" value={b.room_type} muted={th.muted} />}
                                    {b.start_time && <DetailRow label="Check-in" value={fmtTime(b.start_time)} muted={th.muted} />}
                                    {b.end_time && <DetailRow label="Check-out" value={fmtTime(b.end_time)} muted={th.muted} />}
                                  </>
                                )}
                                {b.booking_type === "car_rental" && (
                                  <>
                                    {b.car_type && <DetailRow label="Vehicle" value={b.car_type} muted={th.muted} />}
                                    {b.start_time && <DetailRow label="Pickup" value={fmtTime(b.start_time)} muted={th.muted} />}
                                    {b.end_time && <DetailRow label="Dropoff" value={fmtTime(b.end_time)} muted={th.muted} />}
                                  </>
                                )}
                                {b.booking_type === "restaurant" && (
                                  <>
                                    {b.party_size && <DetailRow label="Party size" value={String(b.party_size)} muted={th.muted} />}
                                    {b.start_time && <DetailRow label="Time" value={fmtTime(b.start_time)} muted={th.muted} />}
                                  </>
                                )}
                                {b.cost && <DetailRow label="Cost" value={`$${Number(b.cost).toFixed(2)}`} muted={th.muted} />}
                              </div>

                              {/* Location row */}
                              {b.booking_type === "hotel" && b.address && <LocationRow address={b.address} accent={th.accent} />}
                              {b.booking_type === "restaurant" && b.address && <LocationRow address={b.address} accent={th.accent} />}
                              {b.booking_type === "car_rental" && b.pickup_location && <LocationRow address={b.pickup_location} accent={th.accent} />}
                              {b.booking_type === "car_rental" && b.dropoff_location && b.dropoff_location !== b.pickup_location && (
                                <LocationRow address={b.dropoff_location} accent={th.accent} />
                              )}

                              {/* Notes row */}
                              {b.notes && <NotesRow notes={b.notes} />}

                              {/* Footer: owner + actions */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                                <span style={{ fontSize: 11, color: th.muted }}>Added by {memberNameMap[b.added_by] || "Unknown"}</span>
                                {canEdit && (
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditingBookingId(b.id); setShowEditBookingModal(true); setExpandedBookingId(null); }}
                                      style={{
                                        background: `${th.accent}1a`, color: th.accent, border: `1px solid ${th.accent}40`,
                                        borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    {confirmDeleteBookingId === b.id ? (
                                      <div style={{ display: "flex", gap: 4 }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDeleteBooking(b.id); }}
                                          style={{
                                            background: "#e74c3c", color: "#fff", border: "none", borderRadius: 8,
                                            padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                          }}
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteBookingId(null); }}
                                          style={{
                                            background: "transparent", color: th.muted, border: `1px solid ${th.cardBorder}`,
                                            borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteBookingId(b.id); }}
                                        style={{
                                          background: "#e74c3c", color: "#fff", border: "none", borderRadius: 8,
                                          padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                        }}
                                      >
                                        🗑️ Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : null}
            {!lodgingCollapsed && Object.keys(bookingsByType).length === 0 && (
              /* Empty state */
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>🧳</div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  No travel or lodging info yet
                </h3>
                <p style={{ color: th.muted, fontSize: 14, marginBottom: 20 }}>
                  Add your hotel, flights, car rentals, and reservations so everyone has the details.
                </p>
                <button
                  onClick={() => setShowAddBookingModal(true)}
                  className="btn"
                  style={{ background: th.accent, padding: "12px 28px", fontSize: 14, fontWeight: 700 }}
                >
                  + Add Booking
                </button>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="fade-in" style={{ textAlign: "center", padding: "32px 20px" }}>
            <p style={{ color: th.muted, fontSize: "13px", opacity: 0.6 }}>
              Use the tabs below to plan your trip.
            </p>
          </div>

          <div style={{ height: "80px" }} />
        </div>

        {/* Add Booking FAB — hidden when add modal is open */}
        {!showAddBookingModal && (
          <button
            onClick={() => setShowAddBookingModal(true)}
            aria-label="Add booking"
            style={{
              position: "fixed",
              bottom: 72,
              right: 16,
              zIndex: 101,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2 || th.accent} 100%)`,
              color: "#fff",
              border: "none",
              fontSize: 28,
              fontWeight: 300,
              cursor: "pointer",
              boxShadow: `0 4px 20px ${th.accent}8c`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
        )}

        {/* Add Booking Modal */}
        {showAddBookingModal && (
          <div onClick={() => setShowAddBookingModal(false)} style={{
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
              <div style={{
                position: "sticky", top: 0, zIndex: 1,
                padding: "18px 20px 14px",
                borderBottom: `1px solid ${th.cardBorder}`,
                background: th.bg,
                borderRadius: "20px 20px 0 0",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", margin: 0 }}>
                  Add Booking
                </h3>
                <button onClick={() => setShowAddBookingModal(false)} style={{
                  background: "none", border: "none", fontSize: "22px",
                  cursor: "pointer", color: th.muted, padding: "4px"
                }}>✕</button>
              </div>
              <div style={{ padding: "16px 20px 24px" }}>
                <AddBookingFormHub
                  tripId={id}
                  userId={userId}
                  accent={th.accent}
                  cardBg={th.card}
                  cardBorder={th.cardBorder}
                  muted={th.muted}
                  text={th.text}
                  onAdded={(booking) => { handleBookingAdded(booking); setShowAddBookingModal(false); }}
                  onCancel={() => setShowAddBookingModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Edit Booking Modal */}
        {showEditBookingModal && editingBookingId && (() => {
          const editBooking = bookings.find((b) => b.id === editingBookingId);
          if (!editBooking) return null;
          return (
            <div onClick={() => { setShowEditBookingModal(false); setEditingBookingId(null); }} style={{
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
                <div style={{
                  position: "sticky", top: 0, zIndex: 1,
                  padding: "18px 20px 14px",
                  borderBottom: `1px solid ${th.cardBorder}`,
                  background: th.bg,
                  borderRadius: "20px 20px 0 0",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", margin: 0 }}>
                    Edit Booking
                  </h3>
                  <button onClick={() => { setShowEditBookingModal(false); setEditingBookingId(null); }} style={{
                    background: "none", border: "none", fontSize: "22px",
                    cursor: "pointer", color: th.muted, padding: "4px"
                  }}>✕</button>
                </div>
                <div style={{ padding: "16px 20px 24px" }}>
                  <EditBookingFormHub
                    booking={editBooking}
                    tripId={id}
                    userId={userId}
                    accent={th.accent}
                    cardBg={th.card}
                    cardBorder={th.cardBorder}
                    muted={th.muted}
                    text={th.text}
                    onEdited={(updated) => { handleBookingEdited(updated); setShowEditBookingModal(false); }}
                    onCancel={() => { setShowEditBookingModal(false); setEditingBookingId(null); }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        <TripSubNav tripId={id} theme={th} role={currentUserRole} />

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  // ─── Setup view: host needs to complete trip details ───
  return (
    <div style={{ color: th.text, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      {th.vibeBg && <div style={{ position: "fixed", inset: 0, background: th.vibeBg, pointerEvents: "none", zIndex: 0 }} />}

      {/* Header */}
      <div style={{ background: th.headerBg, padding: "14px 20px", backdropFilter: "blur(20px)", borderBottom: `1px solid ${th.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: th.muted, padding: "10px", minHeight: "44px", minWidth: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div>
            <div style={{ color: th.text, fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 800 }}>
              {trip.name === "New Trip" ? "New Trip" : trip.name}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.5 }}>
              {trip.location && `📍 ${trip.location}`}
              {trip.location && days.length > 0 && " · "}
              {days.length > 0 && `${formatDate(days[0])} — ${formatDate(days[days.length - 1])}`}
              {!trip.location && days.length === 0 && "Fill in your trip details below"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", paddingBottom: "140px", maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="fade-in">
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>🏷️ Trip Details</h3>
          <div className="card-glass" style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <input value={trip.name} onChange={(e) => updateTrip("name", e.target.value)} placeholder="Trip name" className="input-modern" style={{ fontSize: "16px", fontWeight: 600 }} />
            <input
              ref={locationRef}
              value={trip.location || ""}
              onChange={(e) => updateTrip("location", e.target.value)}
              placeholder="📍 Where are you going?"
              className="input-modern"
            />
            <textarea value={trip.notes || ""} onChange={(e) => updateTrip("notes", e.target.value)} placeholder="📝 Notes..." className="input-modern" rows={2} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "12px", opacity: 0.5 }}>Start <input type="date" value={trip.start_date || ""} onChange={(e) => updateTrip("start_date", e.target.value)} className="input-modern" style={{ width: "auto", marginLeft: "6px" }} /></label>
              <label style={{ fontSize: "12px", opacity: 0.5 }}>End <input type="date" value={trip.end_date || ""} onChange={(e) => updateTrip("end_date", e.target.value)} className="input-modern" style={{ width: "auto", marginLeft: "6px" }} /></label>
              {days.length > 0 && <span className="badge" style={{ background: th.accent, alignSelf: "flex-end" }}>{days.length} days</span>}
            </div>
          </div>

        </div>

        <div style={{ textAlign: "center", padding: "16px", fontSize: "10px", opacity: 0.3 }}>✓ Auto-saved</div>
      </div>

      {/* Sticky Save & Continue CTA */}
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
        pointerEvents: "none" as const,
      }}>
        <button
          onClick={async () => { await flushSaves(); router.push(`/trip/${id}/group`); }}
          style={{
            pointerEvents: "auto" as const,
            width: "100%",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accent2} 100%)`,
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(232,148,58,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            minHeight: "52px",
          }}
        >
          {"Save & Continue to Your Group →"}
        </button>
      </div>

      <TripSubNav tripId={id} theme={th} role={currentUserRole} />
    </div>
  );
}
