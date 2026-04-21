-- ================================================================
-- Nashville Bach Weekend — seed script
-- Paste into Supabase SQL Editor and run.
-- Creates: 1 trip, 8 trip members, 17 itinerary events, event participants.
-- Owner lookup is by email (mrfurleysreservations@gmail.com) — change if needed.
-- ================================================================

DO $$
DECLARE
  v_owner_id UUID;
  v_trip_id UUID;

  -- Trip member ids
  m_joe UUID; m_chris UUID; m_ryan UUID; m_ben UUID;
  m_marcus UUID; m_emily UUID; m_dan UUID; m_sam UUID;

  -- Event ids (17)
  e1 UUID; e2 UUID; e3 UUID; e4 UUID;
  e5 UUID; e6 UUID; e7 UUID; e8 UUID;
  e9 UUID; e10 UUID; e11 UUID; e12 UUID; e13 UUID; e14 UUID;
  e15 UUID; e16 UUID; e17 UUID;

  -- Core group (attends everything except where noted)
  core_ids UUID[];
BEGIN
  -- ───────── Owner lookup ─────────
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE email = 'mrfurleysreservations@gmail.com'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for mrfurleysreservations@gmail.com. Log in once, then rerun.';
  END IF;

  -- ───────── Trip ─────────
  INSERT INTO trips (owner_id, name, trip_type, location, start_date, end_date, notes)
  VALUES (
    v_owner_id,
    'Nashville Bach Weekend',
    'flying',
    'Nashville, TN',
    '2026-05-14',
    '2026-05-17',
    'Bach weekend for Chris. 8 attendees (7 groomsmen + Emily joining Sat/Sun). Staying at Graduate Hotel Nashville.'
  )
  RETURNING id INTO v_trip_id;

  -- ───────── Trip members ─────────
  INSERT INTO trip_members (trip_id, user_id, name, email, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, v_owner_id, 'Joe M.', 'mrfurleysreservations@gmail.com', 'host', 'accepted', v_owner_id, false)
  RETURNING id INTO m_joe;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Chris (groom)', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_chris;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Ryan', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_ryan;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Ben', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_ben;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Marcus', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_marcus;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Emily', 'member', 'accepted', v_owner_id, true)  -- Dress slot ON
  RETURNING id INTO m_emily;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Dan', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_dan;

  INSERT INTO trip_members (trip_id, name, role, status, invited_by, show_dress_slot)
  VALUES (v_trip_id, 'Sam', 'member', 'accepted', v_owner_id, false)
  RETURNING id INTO m_sam;

  -- Core = people who attend everything (Joe, Chris, Ryan, Ben, Marcus, Sam)
  core_ids := ARRAY[m_joe, m_chris, m_ryan, m_ben, m_marcus, m_sam];

  -- ───────── Itinerary events ─────────

  -- DAY 1 — Thu May 14
  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-14', 'afternoon', '14:00', '15:30',
    'Airport pickup + hotel check-in',
    'Match at BNA baggage claim 3. Pedicab over to the hotel.',
    'Graduate Hotel Nashville', 'travel', 'casual', false, 0)
  RETURNING id INTO e1;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-14', 'evening', '17:30', '19:00',
    'Welcome drinks on the rooftop',
    'Res under "Joe M." for 8. Dolly Parton themed — lean into it.',
    'White Limozeen (rooftop)', 'dining', 'smart_casual', false, 1)
  RETURNING id INTO e2;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-14', 'evening', '19:30', '21:30',
    'Welcome dinner — Hattie B''s',
    'Expect a line. Wear something that can handle grease.',
    'Hattie B''s Hot Chicken (Midtown)', 'dining', 'casual', false, 2)
  RETURNING id INTO e3;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-14', 'evening', '22:00', '25:00',
    'Broadway honky tonk crawl',
    'Robert''s → Tootsie''s → Legends. Boots encouraged.',
    'Lower Broadway bars', 'nightlife', 'smart_casual', false, 3)
  RETURNING id INTO e4;

  -- DAY 2 — Fri May 15
  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-15', 'morning', '10:30', '12:00',
    'Biscuit brunch',
    'Grab a number on the app before you leave the hotel.',
    'Biscuit Love (Gulch)', 'dining', 'casual', false, 0)
  RETURNING id INTO e5;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-15', 'afternoon', '13:00', '16:30',
    'Pool day — rooftop cabana',
    'Cabana 4 reserved 1–5. Bring swim + coverup + sandals.',
    'W Nashville pool', 'activity', 'swimwear', false, 1)
  RETURNING id INTO e6;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-15', 'evening', '19:30', '21:30',
    'Groom dinner — Husk',
    'Res 7:30, business-casual-plus. No shorts, no flip-flops.',
    'Husk Nashville', 'dining', 'formal', false, 2)
  RETURNING id INTO e7;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-15', 'evening', '22:00', '25:30',
    'Bars on Broadway (round 2)',
    'Saddle up — country dance floor at Wildhorse later if awake.',
    'Lower Broadway', 'nightlife', 'smart_casual', false, 3)
  RETURNING id INTO e8;

  -- DAY 3 — Sat May 16
  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'morning', '09:30', '10:30',
    'Coffee + breakfast sandwiches',
    'Casual. Breakfast sando + cold brew.',
    'Barista Parlor (East)', 'dining', 'casual', false, 0)
  RETURNING id INTO e9;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'morning', '11:00', '13:30',
    'Pedal tavern bar tour',
    'Active — sneakers, breathable shirt, sunglasses. 2hr route.',
    'Germantown pickup', 'activity', 'active', false, 1)
  RETURNING id INTO e10;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'afternoon', '14:00', '15:30',
    'Lunch — hot chicken crawl stop',
    'Greasy food, plan accordingly.',
    'Party Fowl (The Gulch)', 'dining', 'casual', false, 2)
  RETURNING id INTO e11;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'afternoon', '16:00', '18:00',
    'Country Music Hall of Fame',
    'Air-conditioned. Good decompress from the pedal tavern.',
    'Music City Walk of Fame', 'activity', 'casual', false, 3)
  RETURNING id INTO e12;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'evening', '19:45', '22:00',
    'Tasting menu dinner — Catbird Seat',
    'Jacket recommended for the groom. Shirt + slacks minimum.',
    'The Catbird Seat', 'dining', 'formal', false, 4)
  RETURNING id INTO e13;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-16', 'evening', '22:30', '26:00',
    'Line dancing + late drinks',
    'Boots > sneakers on the dance floor. Dress layers — warm inside.',
    'Wildhorse Saloon', 'nightlife', 'smart_casual', false, 5)
  RETURNING id INTO e14;

  -- DAY 4 — Sun May 17
  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-17', 'morning', '10:30', '12:00',
    'Farewell brunch',
    'Expect a 20-min wait. Bring a hoodie — it''ll be breezy.',
    'Pancake Pantry (Hillsboro)', 'dining', 'casual', false, 0)
  RETURNING id INTO e15;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-17', 'afternoon', '12:30', '14:30',
    'Stroll 12 South',
    'Sunscreen, walking shoes. Tourist photos at the mural.',
    '12 South / Draper James', 'shopping', 'casual', false, 1)
  RETURNING id INTO e16;

  INSERT INTO itinerary_events (trip_id, created_by, date, time_slot, start_time, end_time, title, description, location, event_type, dress_code, is_optional, sort_order)
  VALUES (v_trip_id, v_owner_id, '2026-05-17', 'afternoon', '15:30', '16:30',
    'Hotel checkout + Uber to BNA',
    'Flights start 5:45 PM. Travel clothes.',
    'Graduate Hotel → BNA', 'travel', 'casual', false, 2)
  RETURNING id INTO e17;

  -- ───────── Event participants ─────────
  -- Core group (Joe, Chris, Ryan, Ben, Marcus, Sam) attends every event.
  INSERT INTO event_participants (event_id, trip_member_id, status)
  SELECT e.event_id, m.member_id, 'going'
  FROM unnest(ARRAY[e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13,e14,e15,e16,e17]) AS e(event_id)
  CROSS JOIN unnest(core_ids) AS m(member_id);

  -- Dan attends Thu–Sat through Catbird Seat (events 1-13), skips Wildhorse onward
  INSERT INTO event_participants (event_id, trip_member_id, status)
  SELECT event_id, m_dan, 'going'
  FROM unnest(ARRAY[e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12,e13]) AS t(event_id);

  -- Emily only joins Sat dinner (Catbird Seat) + Sun brunch
  INSERT INTO event_participants (event_id, trip_member_id, status)
  VALUES (e13, m_emily, 'going'), (e15, m_emily, 'going');

  RAISE NOTICE 'Done. Trip ID: %', v_trip_id;
END $$;
