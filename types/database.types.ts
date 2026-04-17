// ─── Trip Planner Pro — Database Types ───
// Minimal types for the 9 tables currently in use.
// Matches schema.sql exactly. Add tables here only when code queries them.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          age_type: string | null;
          avatar_url: string | null;
          alerts_last_seen_at: string | null;
          packing_preferences: Json | null;
          onboarding_completed: boolean;
          gender: string | null;
          age_range: string | null;
          phone: string | null;
          clothing_styles: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          age_type?: string | null;
          avatar_url?: string | null;
          alerts_last_seen_at?: string | null;
          packing_preferences?: Json | null;
          onboarding_completed?: boolean;
          gender?: string | null;
          age_range?: string | null;
          phone?: string | null;
          clothing_styles?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      families: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          car_snack_pref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          car_snack_pref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          age_type: string | null;
          appetite: string | null;
          linked_user_id: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          age_type?: string | null;
          appetite?: string | null;
          linked_user_id?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
      };
      inventory_bins: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          zone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name?: string;
          zone?: string | null;
          created_at?: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          family_id: string;
          bin_id: string | null;
          name: string;
          category: string | null;
          is_consumable: boolean;
          qty_needed: number;
          zone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          bin_id?: string | null;
          name?: string;
          category?: string | null;
          is_consumable?: boolean;
          qty_needed?: number;
          zone?: string | null;
          created_at?: string;
        };
      };
      trips: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          trip_type: string;
          location: string | null;
          notes: string | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          trip_type?: string;
          location?: string | null;
          notes?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_families: {
        Row: {
          id: string;
          trip_id: string;
          source_family_id: string | null;
          name: string;
          members: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          source_family_id?: string | null;
          name: string;
          members?: Json;
          created_at?: string;
        };
      };
      trip_data: {
        Row: {
          id: string;
          trip_id: string;
          attendance: Json;
          meals: Json;
          car_snacks: Json;
          camp_snacks: string | null;
          camp_snack_family: string | null;
          drinks: Json;
          drink_family: Json;
          baby_items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          attendance?: Json;
          meals?: Json;
          car_snacks?: Json;
          camp_snacks?: string | null;
          camp_snack_family?: string | null;
          drinks?: Json;
          drink_family?: Json;
          baby_items?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_inventory: {
        Row: {
          id: string;
          trip_id: string;
          trip_family_id: string;
          bins: Json;
          loose_items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_family_id: string;
          bins?: Json;
          loose_items?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_members: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string | null;
          family_member_id: string | null;
          name: string;
          email: string | null;
          role: string;
          status: string;
          invited_by: string;
          invite_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          user_id?: string | null;
          family_member_id?: string | null;
          name: string;
          email?: string | null;
          role?: string;
          status?: string;
          invited_by: string;
          invite_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_notes: {
        Row: {
          id: string;
          trip_id: string;
          created_by: string;
          title: string;
          body: string | null;
          link_url: string | null;
          photo_url: string | null;
          status: string;
          converted_to: string | null;
          event_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          created_by: string;
          title: string;
          body?: string | null;
          link_url?: string | null;
          photo_url?: string | null;
          status?: string;
          converted_to?: string | null;
          event_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      suitcases: {
        Row: {
          id: string;
          owner_id: string;
          trip_id: string | null;
          person_name: string;
          name: string;
          is_template: boolean;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          trip_id?: string | null;
          person_name: string;
          name: string;
          is_template?: boolean;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      suitcase_photos: {
        Row: {
          id: string;
          suitcase_id: string;
          photo_url: string;
          label: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          suitcase_id: string;
          photo_url: string;
          label?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      suitcase_items: {
        Row: {
          id: string;
          suitcase_id: string;
          item_name: string;
          category: string | null;
          quantity: number;
          packed: boolean;
          wardrobe_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          suitcase_id: string;
          item_name: string;
          category?: string | null;
          quantity?: number;
          packed?: boolean;
          wardrobe_item_id?: string | null;
          created_at?: string;
        };
      };
      wardrobe_items: {
        Row: {
          id: string;
          owner_id: string;
          person_name: string;
          item_name: string;
          category: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          person_name: string;
          item_name: string;
          category?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      saved_gear: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          category?: string | null;
          created_at?: string;
        };
      };
      outfits: {
        Row: {
          id: string;
          owner_id: string;
          person_name: string;
          name: string;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          person_name: string;
          name: string;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      outfit_items: {
        Row: {
          id: string;
          outfit_id: string;
          wardrobe_item_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          outfit_id: string;
          wardrobe_item_id: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      trip_bookings: {
        Row: {
          id: string;
          trip_id: string;
          added_by: string;
          booking_type: string;
          provider_name: string | null;
          confirmation_number: string | null;
          notes: string | null;
          cost: number | null;
          start_date: string | null;
          end_date: string | null;
          start_time: string | null;
          end_time: string | null;
          airline: string | null;
          flight_number: string | null;
          departure_airport: string | null;
          arrival_airport: string | null;
          terminal: string | null;
          seat_info: string | null;
          address: string | null;
          room_type: string | null;
          pickup_location: string | null;
          dropoff_location: string | null;
          car_type: string | null;
          party_size: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          added_by: string;
          booking_type: string;
          provider_name?: string | null;
          confirmation_number?: string | null;
          notes?: string | null;
          cost?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          airline?: string | null;
          flight_number?: string | null;
          departure_airport?: string | null;
          arrival_airport?: string | null;
          terminal?: string | null;
          seat_info?: string | null;
          address?: string | null;
          room_type?: string | null;
          pickup_location?: string | null;
          dropoff_location?: string | null;
          car_type?: string | null;
          party_size?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      friend_links: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: string;
          created_at?: string;
        };
      };
      itinerary_events: {
        Row: {
          id: string;
          trip_id: string;
          created_by: string;
          date: string | null;
          time_slot: string;
          start_time: string | null;
          end_time: string | null;
          title: string;
          description: string | null;
          location: string | null;
          event_type: string;
          dress_code: string | null;
          reservation_number: string | null;
          confirmation_code: string | null;
          cost_per_person: number | null;
          external_link: string | null;
          is_optional: boolean;
          note_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          created_by: string;
          date?: string | null;
          time_slot: string;
          start_time?: string | null;
          end_time?: string | null;
          title: string;
          description?: string | null;
          location?: string | null;
          event_type: string;
          dress_code?: string | null;
          reservation_number?: string | null;
          confirmation_code?: string | null;
          cost_per_person?: number | null;
          external_link?: string | null;
          is_optional?: boolean;
          note_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          trip_member_id: string;
          status: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          trip_member_id: string;
          status?: string;
        };
      };
      packing_items: {
        Row: {
          id: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string | null;
          name: string;
          category: string;
          is_packed: boolean;
          is_multi_use: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_member_id: string;
          event_id?: string | null;
          name: string;
          category?: string;
          is_packed?: boolean;
          is_multi_use?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      packing_outfits: {
        Row: {
          id: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string;
          name: string | null;
          notes: string | null;
          inspo_image_url: string | null;
          inspo_source_url: string | null;
          inspo_label: string | null;
          outfit_group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_member_id: string;
          event_id: string;
          name?: string | null;
          notes?: string | null;
          inspo_image_url?: string | null;
          inspo_source_url?: string | null;
          inspo_label?: string | null;
          outfit_group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      outfit_packing_items: {
        Row: {
          id: string;
          outfit_id: string;
          packing_item_id: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          outfit_id: string;
          packing_item_id: string;
          sort_order?: number;
        };
      };
      outfit_groups: {
        Row: {
          id: string;
          trip_id: string;
          trip_member_id: string;
          date: string;
          label: string | null;
          dress_code: string | null;
          time_of_day: string | null;
          weather_bucket: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          trip_member_id: string;
          date: string;
          label?: string | null;
          dress_code?: string | null;
          time_of_day?: string | null;
          weather_bucket?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_weather_forecast: {
        Row: {
          id: string;
          trip_id: string;
          forecast_date: string;
          time_of_day: string;
          temperature_high_f: number | null;
          temperature_low_f: number | null;
          weather_code: number | null;
          precipitation_probability: number | null;
          weather_bucket: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          forecast_date: string;
          time_of_day: string;
          temperature_high_f?: number | null;
          temperature_low_f?: number | null;
          weather_code?: number | null;
          precipitation_probability?: number | null;
          weather_bucket: string;
          fetched_at?: string;
        };
      };
      outfit_group_events: {
        Row: {
          id: string;
          outfit_group_id: string;
          event_id: string;
        };
        Insert: {
          id?: string;
          outfit_group_id: string;
          event_id: string;
        };
      };
      trip_expenses: {
        Row: {
          id: string;
          trip_id: string;
          created_by: string;
          title: string;
          total_amount: number;
          category: string;
          event_id: string | null;
          expense_date: string | null;
          notes: string | null;
          split_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          created_by: string;
          title: string;
          total_amount: number;
          category?: string;
          event_id?: string | null;
          expense_date?: string | null;
          notes?: string | null;
          split_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      expense_payers: {
        Row: {
          id: string;
          expense_id: string;
          trip_member_id: string;
          amount_paid: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          trip_member_id: string;
          amount_paid: number;
          created_at?: string;
        };
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          family_id: string;
          family_label: string;
          member_count: number;
          amount_owed: number;
          is_settled: boolean;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          family_id: string;
          family_label: string;
          member_count?: number;
          amount_owed: number;
          is_settled?: boolean;
          settled_at?: string | null;
          created_at?: string;
        };
      };
      trip_activity: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string;
          user_name: string;
          action: string;
          entity_type: string;
          entity_name: string;
          entity_id: string | null;
          detail: string | null;
          link_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          user_id: string;
          user_name: string;
          action: string;
          entity_type: string;
          entity_name: string;
          entity_id?: string | null;
          detail?: string | null;
          link_path?: string | null;
          created_at?: string;
        };
      };
      packing_bags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          bag_type: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon?: string;
          bag_type?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      packing_bag_sections: {
        Row: {
          id: string;
          bag_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          bag_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      packing_bag_containers: {
        Row: {
          id: string;
          section_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      packing_item_assignments: {
        Row: {
          id: string;
          packing_item_id: string;
          bag_id: string | null;
          section_id: string | null;
          container_id: string | null;
          trip_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          packing_item_id: string;
          bag_id?: string | null;
          section_id?: string | null;
          container_id?: string | null;
          trip_id: string;
          created_at?: string;
        };
      };
    };
  };
}

// ─── Convenience aliases ───
// Use these in component props and function signatures.

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type Family = Database["public"]["Tables"]["families"]["Row"];
export type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];
export type InventoryBin = Database["public"]["Tables"]["inventory_bins"]["Row"];
export type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type TripFamily = Database["public"]["Tables"]["trip_families"]["Row"];
export type TripData = Database["public"]["Tables"]["trip_data"]["Row"];
export type TripInventory = Database["public"]["Tables"]["trip_inventory"]["Row"];
export type TripMember = Database["public"]["Tables"]["trip_members"]["Row"];
export type TripMemberInsert = Database["public"]["Tables"]["trip_members"]["Insert"];
export type TripNote = Database["public"]["Tables"]["trip_notes"]["Row"];
export type TripNoteInsert = Database["public"]["Tables"]["trip_notes"]["Insert"];
export type Suitcase = Database["public"]["Tables"]["suitcases"]["Row"];
export type SuitcaseInsert = Database["public"]["Tables"]["suitcases"]["Insert"];
export type SuitcaseItem = Database["public"]["Tables"]["suitcase_items"]["Row"];
export type SuitcaseItemInsert = Database["public"]["Tables"]["suitcase_items"]["Insert"];
export type SuitcasePhoto = Database["public"]["Tables"]["suitcase_photos"]["Row"];
export type SuitcasePhotoInsert = Database["public"]["Tables"]["suitcase_photos"]["Insert"];
export type WardrobeItem = Database["public"]["Tables"]["wardrobe_items"]["Row"];
export type WardrobeItemInsert = Database["public"]["Tables"]["wardrobe_items"]["Insert"];
export type SavedGear = Database["public"]["Tables"]["saved_gear"]["Row"];
export type SavedGearInsert = Database["public"]["Tables"]["saved_gear"]["Insert"];
export type Outfit = Database["public"]["Tables"]["outfits"]["Row"];
export type OutfitInsert = Database["public"]["Tables"]["outfits"]["Insert"];
export type OutfitItem = Database["public"]["Tables"]["outfit_items"]["Row"];
export type OutfitItemInsert = Database["public"]["Tables"]["outfit_items"]["Insert"];

export type TripBooking = Database["public"]["Tables"]["trip_bookings"]["Row"];
export type TripBookingInsert = Database["public"]["Tables"]["trip_bookings"]["Insert"];

export type FriendLink = Database["public"]["Tables"]["friend_links"]["Row"];
export type FriendLinkInsert = Database["public"]["Tables"]["friend_links"]["Insert"];

export type TripActivity = Database["public"]["Tables"]["trip_activity"]["Row"];
export type TripActivityInsert = Database["public"]["Tables"]["trip_activity"]["Insert"];

export type ItineraryEvent = Database["public"]["Tables"]["itinerary_events"]["Row"];
export type ItineraryEventInsert = Database["public"]["Tables"]["itinerary_events"]["Insert"];

export type EventParticipant = Database["public"]["Tables"]["event_participants"]["Row"];
export type EventParticipantInsert = Database["public"]["Tables"]["event_participants"]["Insert"];

export type PackingItem = Database["public"]["Tables"]["packing_items"]["Row"];
export type PackingItemInsert = Database["public"]["Tables"]["packing_items"]["Insert"];
export type PackingOutfit = Database["public"]["Tables"]["packing_outfits"]["Row"];
export type PackingOutfitInsert = Database["public"]["Tables"]["packing_outfits"]["Insert"];
export type OutfitPackingItem = Database["public"]["Tables"]["outfit_packing_items"]["Row"];
export type OutfitPackingItemInsert = Database["public"]["Tables"]["outfit_packing_items"]["Insert"];

export type OutfitGroup = Database["public"]["Tables"]["outfit_groups"]["Row"];
export type OutfitGroupInsert = Database["public"]["Tables"]["outfit_groups"]["Insert"];
export type OutfitGroupEvent = Database["public"]["Tables"]["outfit_group_events"]["Row"];
export type OutfitGroupEventInsert = Database["public"]["Tables"]["outfit_group_events"]["Insert"];

export type TripWeatherForecast = Database["public"]["Tables"]["trip_weather_forecast"]["Row"];
export type TripWeatherForecastInsert = Database["public"]["Tables"]["trip_weather_forecast"]["Insert"];

export type TripExpense = Database["public"]["Tables"]["trip_expenses"]["Row"];
export type TripExpenseInsert = Database["public"]["Tables"]["trip_expenses"]["Insert"];
export type ExpensePayer = Database["public"]["Tables"]["expense_payers"]["Row"];
export type ExpensePayerInsert = Database["public"]["Tables"]["expense_payers"]["Insert"];
export type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
export type ExpenseSplitInsert = Database["public"]["Tables"]["expense_splits"]["Insert"];

export type PackingBag = Database["public"]["Tables"]["packing_bags"]["Row"];
export type PackingBagInsert = Database["public"]["Tables"]["packing_bags"]["Insert"];
export type PackingBagSection = Database["public"]["Tables"]["packing_bag_sections"]["Row"];
export type PackingBagSectionInsert = Database["public"]["Tables"]["packing_bag_sections"]["Insert"];
export type PackingBagContainer = Database["public"]["Tables"]["packing_bag_containers"]["Row"];
export type PackingBagContainerInsert = Database["public"]["Tables"]["packing_bag_containers"]["Insert"];
export type PackingItemAssignment = Database["public"]["Tables"]["packing_item_assignments"]["Row"];
export type PackingItemAssignmentInsert = Database["public"]["Tables"]["packing_item_assignments"]["Insert"];

export type OutfitWithItems = Outfit & {
  outfit_items: OutfitItem[];
};
