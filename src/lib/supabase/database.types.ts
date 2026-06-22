// Hand-authored to match supabase/migrations/*. Regenerate with `npm run db:types` once `supabase login` is configured.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          display_name: string;
          avatar_url: string | null;
          city: string | null;
          canton: Database["public"]["Enums"]["canton"] | null;
          locale: Database["public"]["Enums"]["locale"];
          bio: string | null;
          created_at: string;
          role_confirmed: boolean;
          is_admin: boolean;
          is_suspended: boolean;
          suspension_reason: string | null;
          suspended_at: string | null;
          notify_bids: boolean;
          notify_shoot_updates: boolean;
          terms_accepted_at: string | null;
          terms_version: string | null;
        };
        Insert: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          display_name: string;
          avatar_url?: string | null;
          city?: string | null;
          canton?: Database["public"]["Enums"]["canton"] | null;
          locale?: Database["public"]["Enums"]["locale"];
          bio?: string | null;
          created_at?: string;
          role_confirmed?: boolean;
          is_admin?: boolean;
          is_suspended?: boolean;
          suspension_reason?: string | null;
          suspended_at?: string | null;
          notify_bids?: boolean;
          notify_shoot_updates?: boolean;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          display_name?: string;
          avatar_url?: string | null;
          city?: string | null;
          canton?: Database["public"]["Enums"]["canton"] | null;
          locale?: Database["public"]["Enums"]["locale"];
          bio?: string | null;
          created_at?: string;
          role_confirmed?: boolean;
          is_admin?: boolean;
          is_suspended?: boolean;
          suspension_reason?: string | null;
          suspended_at?: string | null;
          notify_bids?: boolean;
          notify_shoot_updates?: boolean;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
        };
        Relationships: [];
      };
      photographer_details: {
        Row: {
          profile_id: string;
          specialties: Database["public"]["Enums"]["shoot_type"][];
          coverage_cantons: Database["public"]["Enums"]["canton"][];
          hourly_rate_chf: number | null;
          website_url: string | null;
          instagram_url: string | null;
          created_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          profile_id: string;
          specialties?: Database["public"]["Enums"]["shoot_type"][];
          coverage_cantons?: Database["public"]["Enums"]["canton"][];
          hourly_rate_chf?: number | null;
          website_url?: string | null;
          instagram_url?: string | null;
          created_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          profile_id?: string;
          specialties?: Database["public"]["Enums"]["shoot_type"][];
          coverage_cantons?: Database["public"]["Enums"]["canton"][];
          hourly_rate_chf?: number | null;
          website_url?: string | null;
          instagram_url?: string | null;
          created_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [];
      };
      portfolio_images: {
        Row: {
          id: string;
          photographer_id: string;
          storage_path: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          photographer_id: string;
          storage_path: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          photographer_id?: string;
          storage_path?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      shoot_images: {
        Row: {
          id: string;
          shoot_id: string;
          storage_path: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          storage_path: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          shoot_id?: string;
          storage_path?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      shoots: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          type: Database["public"]["Enums"]["shoot_type"];
          brief: string;
          location_city: string;
          location_postcode: string | null;
          canton: Database["public"]["Enums"]["canton"];
          shoot_date: string;
          duration_hours: number;
          budget_min_chf: number;
          budget_max_chf: number;
          status: Database["public"]["Enums"]["shoot_status"];
          accepted_bid_id: string | null;
          created_at: string;
          cancellation_reason: string | null;
          is_suspended: boolean;
          suspended_reason: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          type: Database["public"]["Enums"]["shoot_type"];
          brief: string;
          location_city: string;
          location_postcode?: string | null;
          canton: Database["public"]["Enums"]["canton"];
          shoot_date: string;
          duration_hours: number;
          budget_min_chf: number;
          budget_max_chf: number;
          status?: Database["public"]["Enums"]["shoot_status"];
          accepted_bid_id?: string | null;
          created_at?: string;
          cancellation_reason?: string | null;
          is_suspended?: boolean;
          suspended_reason?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["shoot_type"];
          brief?: string;
          location_city?: string;
          location_postcode?: string | null;
          canton?: Database["public"]["Enums"]["canton"];
          shoot_date?: string;
          duration_hours?: number;
          budget_min_chf?: number;
          budget_max_chf?: number;
          status?: Database["public"]["Enums"]["shoot_status"];
          accepted_bid_id?: string | null;
          created_at?: string;
          cancellation_reason?: string | null;
          is_suspended?: boolean;
          suspended_reason?: string | null;
        };
        Relationships: [];
      };
      bids: {
        Row: {
          id: string;
          shoot_id: string;
          photographer_id: string;
          amount_chf: number;
          message: string;
          status: Database["public"]["Enums"]["bid_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          photographer_id: string;
          amount_chf: number;
          message: string;
          status?: Database["public"]["Enums"]["bid_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          shoot_id?: string;
          photographer_id?: string;
          amount_chf?: number;
          message?: string;
          status?: Database["public"]["Enums"]["bid_status"];
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          shoot_id: string | null;
          bid_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          shoot_id?: string | null;
          bid_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          shoot_id?: string | null;
          bid_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          shoot_id: string;
          client_id: string;
          photographer_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          client_id: string;
          photographer_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shoot_id?: string;
          client_id?: string;
          photographer_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          user_id: string;
          photographer_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          photographer_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          photographer_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      photographer_unavailable: {
        Row: {
          photographer_id: string;
          date: string;
        };
        Insert: {
          photographer_id: string;
          date: string;
        };
        Update: {
          photographer_id?: string;
          date?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
          target_id: string;
          reason: string;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          admin_note: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
          target_id: string;
          reason: string;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          admin_note?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
          target_id?: string;
          reason?: string;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          admin_note?: string | null;
        };
        Relationships: [];
      };
      user_blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      email_outbox: {
        Row: {
          id: number;
          recipient_id: string;
          kind: string;
          shoot_id: string | null;
          shoot_title: string | null;
          status: string;
          attempts: number;
          last_error: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: number;
          recipient_id: string;
          kind: string;
          shoot_id?: string | null;
          shoot_title?: string | null;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: number;
          recipient_id?: string;
          kind?: string;
          shoot_id?: string | null;
          shoot_title?: string | null;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          shoot_id: string;
          client_id: string;
          photographer_id: string;
          created_at: string;
          last_message_at: string;
          client_last_read_at: string | null;
          photographer_last_read_at: string | null;
        };
        Insert: {
          id?: string;
          shoot_id: string;
          client_id: string;
          photographer_id: string;
          created_at?: string;
          last_message_at?: string;
          client_last_read_at?: string | null;
          photographer_last_read_at?: string | null;
        };
        Update: {
          id?: string;
          shoot_id?: string;
          client_id?: string;
          photographer_id?: string;
          created_at?: string;
          last_message_at?: string;
          client_last_read_at?: string | null;
          photographer_last_read_at?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      photographer_ratings: {
        Row: {
          photographer_id: string | null;
          avg_rating: number | null;
          review_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_bid: {
        Args: { p_bid_id: string };
        Returns: undefined;
      };
      complete_shoot: {
        Args: { p_shoot_id: string };
        Returns: undefined;
      };
      set_initial_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      is_conversation_participant: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      decline_bid: {
        Args: { p_bid_id: string };
        Returns: undefined;
      };
      get_counterparty_email: {
        Args: { p_shoot_id: string };
        Returns: string;
      };
      shoot_bid_count: {
        Args: { p_shoot_id: string };
        Returns: number;
      };
      is_shoot_client: {
        Args: { p_shoot_id: string };
        Returns: boolean;
      };
      is_accepted_photographer: {
        Args: { p_shoot_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] };
        Returns: boolean;
      };
      is_suspended: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      request_verification: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      blocked_by: {
        Args: { p_other: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "client" | "photographer";
      locale: "de" | "fr" | "en";
      canton:
        | "AG"
        | "AI"
        | "AR"
        | "BE"
        | "BL"
        | "BS"
        | "FR"
        | "GE"
        | "GL"
        | "GR"
        | "JU"
        | "LU"
        | "NE"
        | "NW"
        | "OW"
        | "SG"
        | "SH"
        | "SO"
        | "SZ"
        | "TG"
        | "TI"
        | "UR"
        | "VD"
        | "VS"
        | "ZG"
        | "ZH";
      shoot_type:
        | "wedding"
        | "portrait"
        | "commercial"
        | "event"
        | "architecture"
        | "family"
        | "other";
      shoot_status: "open" | "assigned" | "completed" | "cancelled";
      bid_status: "pending" | "accepted" | "declined" | "withdrawn";
      notification_type:
        | "bid_received"
        | "bid_accepted"
        | "bid_declined"
        | "shoot_cancelled";
      report_target: "profile" | "shoot";
      report_status: "open" | "reviewed" | "dismissed";
      verification_status: "unverified" | "pending" | "verified" | "rejected";
    };
    CompositeTypes: Record<string, never>;
  };
};
