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
      brain_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meaning_object_id: string | null
          metadata: Json | null
          role: string
          source_lang: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meaning_object_id?: string | null
          metadata?: Json | null
          role: string
          source_lang?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meaning_object_id?: string | null
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
          description: string | null
          due_date: string | null
          id: string
          kpi_current: number | null
          kpi_name: string | null
          kpi_target: number | null
          meaning_object_id: string | null
          source_lang: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_current?: number | null
          kpi_name?: string | null
          kpi_target?: number | null
          meaning_object_id?: string | null
          source_lang?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          kpi_current?: number | null
          kpi_name?: string | null
          kpi_target?: number | null
          meaning_object_id?: string | null
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
          description: string | null
          id: string
          meaning_object_id: string | null
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
          description?: string | null
          id?: string
          meaning_object_id?: string | null
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
          description?: string | null
          id?: string
          meaning_object_id?: string | null
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
          id: string
          meaning_json: Json
          source_lang: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          meaning_json?: Json
          source_lang?: string
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
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
          description: string | null
          goal_id: string | null
          id: string
          meaning_object_id: string | null
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
          description?: string | null
          goal_id?: string | null
          id?: string
          meaning_object_id?: string | null
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
          description?: string | null
          goal_id?: string | null
          id?: string
          meaning_object_id?: string | null
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
      tasks: {
        Row: {
          assigned_to: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          definition_of_done: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          is_priority: boolean | null
          meaning_object_id: string | null
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
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          definition_of_done?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          is_priority?: boolean | null
          meaning_object_id?: string | null
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
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          definition_of_done?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          is_priority?: boolean | null
          meaning_object_id?: string | null
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
          id: string
          installed_at: string
          installed_by: string
          is_active: boolean
          workspace_id: string
        }
        Insert: {
          app_id: string
          id?: string
          installed_at?: string
          installed_by: string
          is_active?: boolean
          workspace_id: string
        }
        Update: {
          app_id?: string
          id?: string
          installed_at?: string
          installed_by?: string
          is_active?: boolean
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
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_pricing: "free" | "paid" | "subscription"
      app_role: "owner" | "admin" | "member"
      app_status: "active" | "available" | "coming_soon"
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
