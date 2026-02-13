export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_action_logs: {
        Row: {
          action_input: Json | null
          action_output: Json | null
          action_type: string
          confirmed_at: string | null
          created_at: string
          executed_at: string | null
          id: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_input?: Json | null
          action_output?: Json | null
          action_type: string
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action_input?: Json | null
          action_output?: Json | null
          action_type?: string
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      app_registry: {
        Row: {
          actions: Json | null
          capabilities: string[] | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          pricing: Database["public"]["Enums"]["app_pricing"]
          status: Database["public"]["Enums"]["app_status"]
        }
        Insert: {
          actions?: Json | null
          capabilities?: string[] | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id: string
          name: string
          pricing?: Database["public"]["Enums"]["app_pricing"]
          status?: Database["public"]["Enums"]["app_status"]
        }
        Update: {
          actions?: Json | null
          capabilities?: string[] | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          pricing?: Database["public"]["Enums"]["app_pricing"]
          status?: Database["public"]["Enums"]["app_status"]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_availability_rules: {
        Row: {
          created_at: string
          id: string
          rules: Json
          updated_at: string
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rules?: Json
          updated_at?: string
          vendor_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rules?: Json
          updated_at?: string
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_availability_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_availability_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_blackout_dates: {
        Row: {
          blackout_date: string
          created_at: string
          id: string
          reason: string | null
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          blackout_date: string
          created_at?: string
          id?: string
          reason?: string | null
          vendor_id: string
          workspace_id: string
        }
        Update: {
          blackout_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_blackout_dates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_blackout_dates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_user_id: string
          deposit_paid: number | null
          event_date: string | null
          id: string
          quote_id: string
          quote_request_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_user_id: string
          deposit_paid?: number | null
          event_date?: string | null
          id?: string
          quote_id: string
          quote_request_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at?: string
          vendor_id: string
          workspace_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_user_id?: string
          deposit_paid?: number | null
          event_date?: string | null
          id?: string
          quote_id?: string
          quote_request_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "booking_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_bookings_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "booking_quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_bookings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_reference: string | null
          payment_type: string
          provider: string
          refunded_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_type?: string
          provider?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_type?: string
          provider?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_quote_requests: {
        Row: {
          chat_thread_id: string | null
          created_at: string
          customer_user_id: string
          event_date: string | null
          event_time: string | null
          guest_count: number | null
          id: string
          meaning_object_id: string
          notes: string | null
          service_id: string
          source_lang: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          chat_thread_id?: string | null
          created_at?: string
          customer_user_id: string
          event_date?: string | null
          event_time?: string | null
          guest_count?: number | null
          id?: string
          meaning_object_id: string
          notes?: string | null
          service_id: string
          source_lang?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vendor_id: string
          workspace_id: string
        }
        Update: {
          chat_thread_id?: string | null
          created_at?: string
          customer_user_id?: string
          event_date?: string | null
          event_time?: string | null
          guest_count?: number | null
          id?: string
          meaning_object_id?: string
          notes?: string | null
          service_id?: string
          source_lang?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_quote_requests_chat_thread_id_fkey"
            columns: ["chat_thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quote_requests_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quote_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quote_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quote_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_quotes: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deposit_amount: number | null
          expires_at: string | null
          expiry_hours: number
          id: string
          meaning_object_id: string
          notes: string | null
          quote_request_id: string
          source_lang: string | null
          status: string
          updated_at: string
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          expires_at?: string | null
          expiry_hours?: number
          id?: string
          meaning_object_id: string
          notes?: string | null
          quote_request_id: string
          source_lang?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          expires_at?: string | null
          expiry_hours?: number
          id?: string
          meaning_object_id?: string
          notes?: string | null
          quote_request_id?: string
          source_lang?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_quotes_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "booking_quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_addons: {
        Row: {
          created_at: string
          currency: string
          id: string
          meaning_object_id: string
          name: string
          price: number
          service_id: string
          source_lang: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          meaning_object_id: string
          name: string
          price?: number
          service_id: string
          source_lang?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          meaning_object_id?: string
          name?: string
          price?: number
          service_id?: string
          source_lang?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_addons_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_addons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          description_meaning_object_id: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          max_guests: number | null
          min_guests: number | null
          price_amount: number | null
          price_type: string
          sort_order: number | null
          source_lang: string | null
          title: string
          title_meaning_object_id: string
          updated_at: string
          vendor_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          description_meaning_object_id?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          max_guests?: number | null
          min_guests?: number | null
          price_amount?: number | null
          price_type?: string
          sort_order?: number | null
          source_lang?: string | null
          title: string
          title_meaning_object_id: string
          updated_at?: string
          vendor_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          description_meaning_object_id?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          max_guests?: number | null
          min_guests?: number | null
          price_amount?: number | null
          price_type?: string
          sort_order?: number | null
          source_lang?: string | null
          title?: string
          title_meaning_object_id?: string
          updated_at?: string
          vendor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_desc_mo_fk"
            columns: ["description_meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_title_mo_fk"
            columns: ["title_meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          accent_color: string | null
          ai_booking_assistant_enabled: boolean
          app_build_number: number | null
          app_bundle_id: string | null
          app_description: string | null
          app_icon_url: string | null
          app_keywords: string | null
          app_name: string | null
          app_privacy_url: string | null
          app_splash_url: string | null
          app_support_email: string | null
          app_version: string | null
          cancellation_policy: string
          commission_mode: string
          commission_rate: number | null
          contact_email: string | null
          created_at: string
          currency: string
          deposit_enabled: boolean
          deposit_type: string | null
          deposit_value: number | null
          distribution_mode: string
          id: string
          is_live: boolean
          logo_url: string | null
          payment_config: Json | null
          payment_provider: string | null
          primary_color: string | null
          publishing_progress: Json | null
          refund_policy: string | null
          tenant_slug: string | null
          theme_template: string
          tone: string | null
          updated_at: string
          whatsapp_number: string | null
          workspace_id: string
        }
        Insert: {
          accent_color?: string | null
          ai_booking_assistant_enabled?: boolean
          app_build_number?: number | null
          app_bundle_id?: string | null
          app_description?: string | null
          app_icon_url?: string | null
          app_keywords?: string | null
          app_name?: string | null
          app_privacy_url?: string | null
          app_splash_url?: string | null
          app_support_email?: string | null
          app_version?: string | null
          cancellation_policy?: string
          commission_mode?: string
          commission_rate?: number | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          deposit_enabled?: boolean
          deposit_type?: string | null
          deposit_value?: number | null
          distribution_mode?: string
          id?: string
          is_live?: boolean
          logo_url?: string | null
          payment_config?: Json | null
          payment_provider?: string | null
          primary_color?: string | null
          publishing_progress?: Json | null
          refund_policy?: string | null
          tenant_slug?: string | null
          theme_template?: string
          tone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          workspace_id: string
        }
        Update: {
          accent_color?: string | null
          ai_booking_assistant_enabled?: boolean
          app_build_number?: number | null
          app_bundle_id?: string | null
          app_description?: string | null
          app_icon_url?: string | null
          app_keywords?: string | null
          app_name?: string | null
          app_privacy_url?: string | null
          app_splash_url?: string | null
          app_support_email?: string | null
          app_version?: string | null
          cancellation_policy?: string
          commission_mode?: string
          commission_rate?: number | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          deposit_enabled?: boolean
          deposit_type?: string | null
          deposit_value?: number | null
          distribution_mode?: string
          id?: string
          is_live?: boolean
          logo_url?: string | null
          payment_config?: Json | null
          payment_provider?: string | null
          primary_color?: string | null
          publishing_progress?: Json | null
          refund_policy?: string | null
          tenant_slug?: string | null
          theme_template?: string
          tone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          grace_period_days: number
          id: string
          plan: string
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          grace_period_days?: number
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          grace_period_days?: number
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_vendor_profiles: {
        Row: {
          bio: string | null
          bio_meaning_object_id: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          display_name_meaning_object_id: string
          email: string | null
          id: string
          logo_url: string | null
          source_lang: string | null
          updated_at: string
          vendor_id: string
          whatsapp: string | null
          workspace_id: string
        }
        Insert: {
          bio?: string | null
          bio_meaning_object_id?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          display_name_meaning_object_id: string
          email?: string | null
          id?: string
          logo_url?: string | null
          source_lang?: string | null
          updated_at?: string
          vendor_id: string
          whatsapp?: string | null
          workspace_id: string
        }
        Update: {
          bio?: string | null
          bio_meaning_object_id?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          display_name_meaning_object_id?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          source_lang?: string | null
          updated_at?: string
          vendor_id?: string
          whatsapp?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_vendor_profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "booking_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_vendor_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bvp_bio_mo_fk"
            columns: ["bio_meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bvp_display_name_mo_fk"
            columns: ["display_name_meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_vendors: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          owner_user_id: string
          status: Database["public"]["Enums"]["booking_vendor_status"]
          suspended_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          owner_user_id: string
          status?: Database["public"]["Enums"]["booking_vendor_status"]
          suspended_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          owner_user_id?: string
          status?: Database["public"]["Enums"]["booking_vendor_status"]
          suspended_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_vendors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          meaning_object_id: string
          metadata: Json | null
          role: string
          source_lang: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          meaning_object_id: string
          metadata?: Json | null
          role: string
          source_lang?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          meaning_object_id?: string
          metadata?: Json | null
          role?: string
          source_lang?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_messages_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_contexts: {
        Row: {
          business_description: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          created_at: string
          has_team: boolean | null
          id: string
          ninety_day_focus: string[] | null
          primary_pain: string | null
          secondary_pains: string[] | null
          setup_completed: boolean | null
          team_size: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_description?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          has_team?: boolean | null
          id?: string
          ninety_day_focus?: string[] | null
          primary_pain?: string | null
          secondary_pains?: string[] | null
          setup_completed?: boolean | null
          team_size?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_description?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          has_team?: boolean | null
          id?: string
          ninety_day_focus?: string[] | null
          primary_pain?: string | null
          secondary_pains?: string[] | null
          setup_completed?: boolean | null
          team_size?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_contexts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
          storage_path: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          message_id: string
          storage_path: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
          storage_path?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          meaning_object_id: string
          sender_user_id: string
          source_lang: string
          thread_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meaning_object_id: string
          sender_user_id: string
          source_lang?: string
          thread_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meaning_object_id?: string
          sender_user_id?: string
          source_lang?: string
          thread_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_members: {
        Row: {
          created_at: string
          id: string
          last_read_at: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          title: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          title?: string | null
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          title?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_memory: {
        Row: {
          confidence: number
          created_at: string
          evidence_refs: Json
          id: string
          last_seen_at: string
          memory_type: string
          statement: string
          status: string
          workspace_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_refs?: Json
          id?: string
          last_seen_at?: string
          memory_type: string
          statement: string
          status?: string
          workspace_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_refs?: Json
          id?: string
          last_seen_at?: string
          memory_type?: string
          statement?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_risk_scores: {
        Row: {
          company_id: string
          computed_at: string
          created_at: string
          id: string
          metadata: Json
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          risk_type: string
          window_days: number
        }
        Insert: {
          company_id: string
          computed_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          risk_type: string
          window_days?: number
        }
        Update: {
          company_id?: string
          computed_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          risk_type?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_risk_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      content_translations: {
        Row: {
          created_at: string
          field: string
          id: string
          meaning_object_id: string
          target_lang: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          field?: string
          id?: string
          meaning_object_id: string
          target_lang: string
          translated_text: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          meaning_object_id?: string
          target_lang?: string
          translated_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_translations_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_preferences: {
        Row: {
          created_at: string
          email: boolean
          enabled: boolean
          id: string
          in_app: boolean
          schedule_day: number
          schedule_hour: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: boolean
          enabled?: boolean
          id?: string
          in_app?: boolean
          schedule_day?: number
          schedule_hour?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: boolean
          enabled?: boolean
          id?: string
          in_app?: boolean
          schedule_day?: number
          schedule_hour?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          kpi_current: number | null
          kpi_name: string | null
          kpi_target: number | null
          meaning_object_id: string
          source_lang: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_current?: number | null
          kpi_name?: string | null
          kpi_target?: number | null
          meaning_object_id: string
          source_lang?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_current?: number | null
          kpi_name?: string | null
          kpi_target?: number | null
          meaning_object_id?: string
          source_lang?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          meaning_object_id: string
          source: string
          source_lang: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          meaning_object_id: string
          source?: string
          source_lang?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          meaning_object_id?: string
          source?: string
          source_lang?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meaning_objects: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          meaning_json: Json
          source_lang: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          meaning_json?: Json
          source_lang?: string
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          meaning_json?: Json
          source_lang?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meaning_objects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channels: string[]
          created_at: string
          data_json: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
          week_key: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          channels?: string[]
          created_at?: string
          data_json?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
          week_key?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          channels?: string[]
          created_at?: string
          data_json?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
          week_key?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oil_settings: {
        Row: {
          always_explain_why: boolean
          auto_surface_blind_spots: boolean
          created_at: string
          exclude_market_news: boolean
          external_knowledge: string
          guidance_style: string
          id: string
          include_industry_benchmarks: boolean
          include_operational_best_practices: boolean
          insights_visibility: string
          leadership_guidance_enabled: boolean
          show_best_practice_comparisons: boolean
          show_in_brain_only: boolean
          show_indicator_strip: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          always_explain_why?: boolean
          auto_surface_blind_spots?: boolean
          created_at?: string
          exclude_market_news?: boolean
          external_knowledge?: string
          guidance_style?: string
          id?: string
          include_industry_benchmarks?: boolean
          include_operational_best_practices?: boolean
          insights_visibility?: string
          leadership_guidance_enabled?: boolean
          show_best_practice_comparisons?: boolean
          show_in_brain_only?: boolean
          show_indicator_strip?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          always_explain_why?: boolean
          auto_surface_blind_spots?: boolean
          created_at?: string
          exclude_market_news?: boolean
          external_knowledge?: string
          guidance_style?: string
          id?: string
          include_industry_benchmarks?: boolean
          include_operational_best_practices?: boolean
          insights_visibility?: string
          leadership_guidance_enabled?: boolean
          show_best_practice_comparisons?: boolean
          show_in_brain_only?: boolean
          show_indicator_strip?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oil_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_completions: {
        Row: {
          completed_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_completions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      org_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meaning_object_id: string | null
          metadata: Json | null
          object_type: string
          severity_hint: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meaning_object_id?: string | null
          metadata?: Json | null
          object_type: string
          severity_hint?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meaning_object_id?: string | null
          metadata?: Json | null
          object_type?: string
          severity_hint?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_events_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      org_indicators: {
        Row: {
          created_at: string
          drivers: Json
          id: string
          indicator_key: string
          score: number
          trend: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          drivers?: Json
          id?: string
          indicator_key: string
          score?: number
          trend?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          drivers?: Json
          id?: string
          indicator_key?: string
          score?: number
          trend?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_indicators_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          goal_id: string | null
          id: string
          meaning_object_id: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          source_lang: string | null
          title: string
          updated_at: string
          weekly_breakdown: Json | null
          workspace_id: string
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          meaning_object_id: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          source_lang?: string | null
          title: string
          updated_at?: string
          weekly_breakdown?: Json | null
          workspace_id: string
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          meaning_object_id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          source_lang?: string | null
          title?: string
          updated_at?: string
          weekly_breakdown?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          content_locale: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_locale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          content_locale?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_locale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          content_locale?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_locale?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_forecasts: {
        Row: {
          company_id: string
          computed_at: string
          created_at: string
          forecast: Json
          horizon_days: number
          id: string
          model_meta: Json
          risk_type: string
          workspace_id: string | null
        }
        Insert: {
          company_id: string
          computed_at?: string
          created_at?: string
          forecast?: Json
          horizon_days?: number
          id?: string
          model_meta?: Json
          risk_type: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string
          computed_at?: string
          created_at?: string
          forecast?: Json
          horizon_days?: number
          id?: string
          model_meta?: Json
          risk_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_forecasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_forecasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_snapshots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metrics: Json
          snapshot_date: string
          workspace_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          snapshot_date?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          assignment_source: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          definition_of_done: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          is_priority: boolean | null
          meaning_object_id: string
          plan_id: string | null
          priority: number | null
          source_lang: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          week_bucket: string | null
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          definition_of_done?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          is_priority?: boolean | null
          meaning_object_id: string
          plan_id?: string | null
          priority?: number | null
          source_lang?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          week_bucket?: string | null
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          assignment_source?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          definition_of_done?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          is_priority?: boolean | null
          meaning_object_id?: string
          plan_id?: string | null
          priority?: number | null
          source_lang?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          week_bucket?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meaning_object_id_fkey"
            columns: ["meaning_object_id"]
            isOneToOne: false
            referencedRelation: "meaning_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkins: {
        Row: {
          action_items: Json | null
          ai_recommendations: Json | null
          ai_summary: string | null
          blocked_items: Json | null
          completed_at: string
          completed_by: string
          completed_items: string[] | null
          created_at: string
          goal_reviews: Json | null
          id: string
          next_week_priorities: string[] | null
          oil_snapshot: Json | null
          risks_and_decisions: string[] | null
          week_start: string
          workspace_id: string
        }
        Insert: {
          action_items?: Json | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          blocked_items?: Json | null
          completed_at?: string
          completed_by: string
          completed_items?: string[] | null
          created_at?: string
          goal_reviews?: Json | null
          id?: string
          next_week_priorities?: string[] | null
          oil_snapshot?: Json | null
          risks_and_decisions?: string[] | null
          week_start: string
          workspace_id: string
        }
        Update: {
          action_items?: Json | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          blocked_items?: Json | null
          completed_at?: string
          completed_by?: string
          completed_items?: string[] | null
          created_at?: string
          goal_reviews?: Json | null
          id?: string
          next_week_priorities?: string[] | null
          oil_snapshot?: Json | null
          risks_and_decisions?: string[] | null
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digests: {
        Row: {
          blockers_summary: Json | null
          created_at: string
          decisions_summary: Json | null
          id: string
          narrative_text: string | null
          read_at: string | null
          stats: Json
          user_id: string
          week_end: string
          week_start: string
          workspace_id: string
        }
        Insert: {
          blockers_summary?: Json | null
          created_at?: string
          decisions_summary?: Json | null
          id?: string
          narrative_text?: string | null
          read_at?: string | null
          stats?: Json
          user_id: string
          week_end: string
          week_start: string
          workspace_id: string
        }
        Update: {
          blockers_summary?: Json | null
          created_at?: string
          decisions_summary?: Json | null
          id?: string
          narrative_text?: string | null
          read_at?: string | null
          stats?: Json
          user_id?: string
          week_end?: string
          week_start?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_digests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_apps: {
        Row: {
          app_id: string
          billing_status: string
          id: string
          installed_at: string
          installed_by: string
          is_active: boolean
          plan: string
          uninstalled_at: string | null
          workspace_id: string
        }
        Insert: {
          app_id: string
          billing_status?: string
          id?: string
          installed_at?: string
          installed_by: string
          is_active?: boolean
          plan?: string
          uninstalled_at?: string | null
          workspace_id: string
        }
        Update: {
          app_id?: string
          billing_status?: string
          id?: string
          installed_at?: string
          installed_by?: string
          is_active?: boolean
          plan?: string
          uninstalled_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "app_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_apps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          custom_role_name: string | null
          email: string | null
          id: string
          invite_status: string
          invited_at: string
          joined_at: string | null
          team_role: Database["public"]["Enums"]["team_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          custom_role_name?: string | null
          email?: string | null
          id?: string
          invite_status?: string
          invited_at?: string
          joined_at?: string | null
          team_role?: Database["public"]["Enums"]["team_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          custom_role_name?: string | null
          email?: string | null
          id?: string
          invite_status?: string
          invited_at?: string
          joined_at?: string | null
          team_role?: Database["public"]["Enums"]["team_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_risk_scores: {
        Row: {
          company_id: string
          computed_at: string
          created_at: string
          id: string
          metadata: Json
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          risk_type: string
          window_days: number
          workspace_id: string
        }
        Insert: {
          company_id: string
          computed_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          risk_type: string
          window_days?: number
          workspace_id: string
        }
        Update: {
          company_id?: string
          computed_at?: string
          created_at?: string
          id?: string
          metadata?: Json
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          risk_type?: string
          window_days?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_risk_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_risk_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          company_id: string
          created_at: string
          default_locale: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_locale?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_locale?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booking_notify: {
        Args: {
          _data_json: Json
          _title: string
          _type: string
          _user_id: string
          _workspace_id: string
        }
        Returns: undefined
      }
      cleanup_old_org_events: { Args: never; Returns: undefined }
      cleanup_stale_memory: { Args: never; Returns: undefined }
      get_live_booking_tenant_by_slug: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_thread_workspace: { Args: { _thread_id: string }; Returns: string }
      get_workspace_company: {
        Args: { _workspace_id: string }
        Returns: string
      }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_booking_subscription_active: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      is_booking_vendor_owner: {
        Args: { _user_id: string; _vendor_id: string }
        Returns: boolean
      }
      is_chat_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      workspace_id_from_path: { Args: { path: string }; Returns: string }
    }
    Enums: {
      app_pricing: "free" | "paid" | "subscription"
      app_role: "owner" | "admin" | "member"
      app_status: "active" | "available" | "coming_soon"
      booking_status:
        | "requested"
        | "quoted"
        | "accepted"
        | "paid_confirmed"
        | "completed"
        | "cancelled"
      booking_vendor_status: "pending" | "approved" | "suspended"
      business_type:
        | "trade"
        | "services"
        | "factory"
        | "online"
        | "retail"
        | "consulting"
        | "other"
      plan_type:
        | "sales"
        | "marketing"
        | "operations"
        | "finance"
        | "team"
        | "custom"
      risk_level: "low" | "moderate" | "elevated" | "high" | "critical"
      task_status: "backlog" | "planned" | "in_progress" | "blocked" | "done"
      team_role:
        | "owner"
        | "operations"
        | "sales"
        | "marketing"
        | "finance"
        | "custom"
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
  public: {
    Enums: {
      app_pricing: ["free", "paid", "subscription"],
      app_role: ["owner", "admin", "member"],
      app_status: ["active", "available", "coming_soon"],
      booking_status: [
        "requested",
        "quoted",
        "accepted",
        "paid_confirmed",
        "completed",
        "cancelled",
      ],
      booking_vendor_status: ["pending", "approved", "suspended"],
      business_type: [
        "trade",
        "services",
        "factory",
        "online",
        "retail",
        "consulting",
        "other",
      ],
      plan_type: [
        "sales",
        "marketing",
        "operations",
        "finance",
        "team",
        "custom",
      ],
      risk_level: ["low", "moderate", "elevated", "high", "critical"],
      task_status: ["backlog", "planned", "in_progress", "blocked", "done"],
      team_role: [
        "owner",
        "operations",
        "sales",
        "marketing",
        "finance",
        "custom",
      ],
    },
  },
} as const
