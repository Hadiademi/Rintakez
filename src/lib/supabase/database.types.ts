export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          meta: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          meta?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount_chf: number
          created_at: string
          id: string
          message: string
          photographer_id: string
          shoot_id: string
          status: Database["public"]["Enums"]["bid_status"]
        }
        Insert: {
          amount_chf: number
          created_at?: string
          id?: string
          message: string
          photographer_id: string
          shoot_id: string
          status?: Database["public"]["Enums"]["bid_status"]
        }
        Update: {
          amount_chf?: number
          created_at?: string
          id?: string
          message?: string
          photographer_id?: string
          shoot_id?: string
          status?: Database["public"]["Enums"]["bid_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bids_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          client_last_read_at: string | null
          created_at: string
          id: string
          last_message_at: string
          last_message_body: string | null
          last_sender_id: string | null
          photographer_id: string
          photographer_last_read_at: string | null
          shoot_id: string
        }
        Insert: {
          client_id: string
          client_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_body?: string | null
          last_sender_id?: string | null
          photographer_id: string
          photographer_last_read_at?: string | null
          shoot_id: string
        }
        Update: {
          client_id?: string
          client_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_body?: string | null
          last_sender_id?: string | null
          photographer_id?: string
          photographer_last_read_at?: string | null
          shoot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: true
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          opened_by: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          shoot_id: string
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          opened_by: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shoot_id: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          created_at?: string
          id?: string
          opened_by?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shoot_id?: string
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: number
          kind: string
          last_error: string | null
          recipient_id: string
          sent_at: string | null
          shoot_id: string | null
          shoot_title: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: never
          kind: string
          last_error?: string | null
          recipient_id: string
          sent_at?: string | null
          shoot_id?: string | null
          shoot_title?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: never
          kind?: string
          last_error?: string | null
          recipient_id?: string
          sent_at?: string | null
          shoot_id?: string | null
          shoot_title?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          photographer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          photographer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          photographer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_email_log: {
        Row: {
          created_at: string
          kind: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          subject_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          subject_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          image_path: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          bid_id: string | null
          created_at: string
          id: string
          read_at: string | null
          shoot_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          bid_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          shoot_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          bid_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          shoot_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_details: {
        Row: {
          cover_path: string | null
          coverage_cantons: Database["public"]["Enums"]["canton"][]
          created_at: string
          disciplines: Database["public"]["Enums"]["discipline"][]
          hourly_rate_chf: number | null
          instagram_url: string | null
          profile_id: string
          specialties: Database["public"]["Enums"]["shoot_type"][]
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          website_url: string | null
        }
        Insert: {
          cover_path?: string | null
          coverage_cantons?: Database["public"]["Enums"]["canton"][]
          created_at?: string
          disciplines?: Database["public"]["Enums"]["discipline"][]
          hourly_rate_chf?: number | null
          instagram_url?: string | null
          profile_id: string
          specialties?: Database["public"]["Enums"]["shoot_type"][]
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website_url?: string | null
        }
        Update: {
          cover_path?: string | null
          coverage_cantons?: Database["public"]["Enums"]["canton"][]
          created_at?: string
          disciplines?: Database["public"]["Enums"]["discipline"][]
          hourly_rate_chf?: number | null
          instagram_url?: string | null
          profile_id?: string
          specialties?: Database["public"]["Enums"]["shoot_type"][]
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photographer_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_unavailable: {
        Row: {
          date: string
          photographer_id: string
        }
        Insert: {
          date: string
          photographer_id: string
        }
        Update: {
          date?: string
          photographer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photographer_unavailable_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photographer_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photographer_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photographer_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string
          id: number
          photographer_id: string
          viewed_on: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          photographer_id: string
          viewed_on?: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          photographer_id?: string
          viewed_on?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          canton: Database["public"]["Enums"]["canton"] | null
          city: string | null
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          is_suspended: boolean
          locale: Database["public"]["Enums"]["locale"]
          notify_bids: boolean
          notify_messages: boolean
          notify_shoot_updates: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_confirmed: boolean
          suspended_at: string | null
          suspension_reason: string | null
          terms_accepted_at: string | null
          terms_version: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          canton?: Database["public"]["Enums"]["canton"] | null
          city?: string | null
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          is_suspended?: boolean
          locale?: Database["public"]["Enums"]["locale"]
          notify_bids?: boolean
          notify_messages?: boolean
          notify_shoot_updates?: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_confirmed?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          canton?: Database["public"]["Enums"]["canton"] | null
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          is_suspended?: boolean
          locale?: Database["public"]["Enums"]["locale"]
          notify_bids?: boolean
          notify_messages?: boolean
          notify_shoot_updates?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_confirmed?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          photographer_id: string
          rating: number
          reply: string | null
          reply_at: string | null
          shoot_id: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          photographer_id: string
          rating: number
          reply?: string | null
          reply_at?: string | null
          shoot_id: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          photographer_id?: string
          rating?: number
          reply?: string | null
          reply_at?: string | null
          shoot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: true
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_images: {
        Row: {
          created_at: string
          id: string
          shoot_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          shoot_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          shoot_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_images_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_invitations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          photographer_id: string
          shoot_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          photographer_id: string
          shoot_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          photographer_id?: string
          shoot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_invitations_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoot_invitations_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoots: {
        Row: {
          accepted_bid_id: string | null
          brief: string
          budget_max_chf: number
          budget_min_chf: number
          cancellation_reason: string | null
          canton: Database["public"]["Enums"]["canton"]
          client_id: string
          created_at: string
          discipline: Database["public"]["Enums"]["discipline"]
          duration_hours: number
          id: string
          is_suspended: boolean
          location_city: string
          location_postcode: string | null
          shoot_date: string
          status: Database["public"]["Enums"]["shoot_status"]
          suspended_reason: string | null
          title: string
          type: Database["public"]["Enums"]["shoot_type"]
        }
        Insert: {
          accepted_bid_id?: string | null
          brief: string
          budget_max_chf: number
          budget_min_chf: number
          cancellation_reason?: string | null
          canton: Database["public"]["Enums"]["canton"]
          client_id: string
          created_at?: string
          discipline?: Database["public"]["Enums"]["discipline"]
          duration_hours: number
          id?: string
          is_suspended?: boolean
          location_city: string
          location_postcode?: string | null
          shoot_date: string
          status?: Database["public"]["Enums"]["shoot_status"]
          suspended_reason?: string | null
          title: string
          type: Database["public"]["Enums"]["shoot_type"]
        }
        Update: {
          accepted_bid_id?: string | null
          brief?: string
          budget_max_chf?: number
          budget_min_chf?: number
          cancellation_reason?: string | null
          canton?: Database["public"]["Enums"]["canton"]
          client_id?: string
          created_at?: string
          discipline?: Database["public"]["Enums"]["discipline"]
          duration_hours?: number
          id?: string
          is_suspended?: boolean
          location_city?: string
          location_postcode?: string | null
          shoot_date?: string
          status?: Database["public"]["Enums"]["shoot_status"]
          suspended_reason?: string | null
          title?: string
          type?: Database["public"]["Enums"]["shoot_type"]
        }
        Relationships: [
          {
            foreignKeyName: "shoots_accepted_bid_fk"
            columns: ["accepted_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      photographer_ratings: {
        Row: {
          avg_rating: number | null
          photographer_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_bid: { Args: { p_bid_id: string }; Returns: undefined }
      admin_liquidity_stats: { Args: never; Returns: Json }
      blocked_by: { Args: { p_other: string }; Returns: boolean }
      can_invite_to_shoot: { Args: { p_shoot_id: string }; Returns: boolean }
      can_view_shoot: { Args: { p_shoot_id: string }; Returns: boolean }
      complete_shoot: { Args: { p_shoot_id: string }; Returns: undefined }
      decline_bid: { Args: { p_bid_id: string }; Returns: undefined }
      get_counterparty_email: { Args: { p_shoot_id: string }; Returns: string }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_accepted_photographer: {
        Args: { p_shoot_id: string }
        Returns: boolean
      }
      is_blocked_in_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_shoot_client: { Args: { p_shoot_id: string }; Returns: boolean }
      is_suspended: { Args: never; Returns: boolean }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      photographer_completed_shoots_count: {
        Args: { p_photographer_id: string }
        Returns: number
      }
      photographer_view_count: {
        Args: { p_photographer_id: string; p_since?: string }
        Returns: number
      }
      record_profile_view: {
        Args: { p_photographer_id: string }
        Returns: undefined
      }
      request_verification: { Args: never; Returns: undefined }
      set_initial_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: undefined
      }
      shoot_bid_count: { Args: { p_shoot_id: string }; Returns: number }
    }
    Enums: {
      bid_status: "pending" | "accepted" | "declined" | "withdrawn"
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
        | "ZH"
      discipline: "photo" | "video"
      dispute_status: "open" | "resolved" | "dismissed"
      locale: "de" | "fr" | "en"
      notification_type:
        | "bid_received"
        | "bid_accepted"
        | "bid_declined"
        | "shoot_cancelled"
        | "message_received"
        | "shoot_reopened"
        | "review_received"
        | "verification_approved"
        | "verification_rejected"
        | "shoot_invitation"
        | "shoot_match"
      report_category:
        | "spam"
        | "harassment"
        | "scam"
        | "inappropriate_content"
        | "other"
      report_status: "open" | "reviewed" | "dismissed"
      report_target: "profile" | "shoot" | "review" | "message"
      shoot_status: "open" | "assigned" | "completed" | "cancelled"
      shoot_type:
        | "wedding"
        | "portrait"
        | "commercial"
        | "event"
        | "architecture"
        | "family"
        | "other"
      user_role: "client" | "photographer"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bid_status: ["pending", "accepted", "declined", "withdrawn"],
      canton: [
        "AG",
        "AI",
        "AR",
        "BE",
        "BL",
        "BS",
        "FR",
        "GE",
        "GL",
        "GR",
        "JU",
        "LU",
        "NE",
        "NW",
        "OW",
        "SG",
        "SH",
        "SO",
        "SZ",
        "TG",
        "TI",
        "UR",
        "VD",
        "VS",
        "ZG",
        "ZH",
      ],
      discipline: ["photo", "video"],
      dispute_status: ["open", "resolved", "dismissed"],
      locale: ["de", "fr", "en"],
      notification_type: [
        "bid_received",
        "bid_accepted",
        "bid_declined",
        "shoot_cancelled",
        "message_received",
        "shoot_reopened",
        "review_received",
        "verification_approved",
        "verification_rejected",
        "shoot_invitation",
        "shoot_match",
      ],
      report_category: [
        "spam",
        "harassment",
        "scam",
        "inappropriate_content",
        "other",
      ],
      report_status: ["open", "reviewed", "dismissed"],
      report_target: ["profile", "shoot", "review", "message"],
      shoot_status: ["open", "assigned", "completed", "cancelled"],
      shoot_type: [
        "wedding",
        "portrait",
        "commercial",
        "event",
        "architecture",
        "family",
        "other",
      ],
      user_role: ["client", "photographer"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const

