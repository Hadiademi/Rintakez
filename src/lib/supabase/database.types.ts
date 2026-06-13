// Hand-authored to match supabase/migrations/*. Regenerate with `npm run db:types` once `supabase login` is configured.

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
        };
        Insert: {
          profile_id: string;
          specialties?: Database["public"]["Enums"]["shoot_type"][];
          coverage_cantons?: Database["public"]["Enums"]["canton"][];
          hourly_rate_chf?: number | null;
          website_url?: string | null;
          instagram_url?: string | null;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          specialties?: Database["public"]["Enums"]["shoot_type"][];
          coverage_cantons?: Database["public"]["Enums"]["canton"][];
          hourly_rate_chf?: number | null;
          website_url?: string | null;
          instagram_url?: string | null;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      accept_bid: {
        Args: { p_bid_id: string };
        Returns: undefined;
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
    };
    CompositeTypes: Record<string, never>;
  };
};
