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
    PostgrestVersion: "14.18"
  }
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
      admin_actions: {
        Row: {
          action: string
          admin_id: string | null
          after: Json | null
          before: Json | null
          channel_id: string
          created_at: string
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          channel_id: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          channel_id?: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_admins: {
        Row: {
          channel_id: string
          created_at: string
          fan_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          fan_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          fan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_admins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_admins_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          hero_url: string | null
          id: string
          links: Json
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          tagline: string | null
          timezone: string
        }
        Insert: {
          created_at?: string
          hero_url?: string | null
          id?: string
          links?: Json
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          tagline?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          hero_url?: string | null
          id?: string
          links?: Json
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          tagline?: string | null
          timezone?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          fan_id: string
          id: string
          is_seed: boolean
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          fan_id: string
          id?: string
          is_seed?: boolean
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          fan_id?: string
          id?: string
          is_seed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signups: {
        Row: {
          channel_id: string
          consented_at: string
          email: string
          fan_id: string
          id: string
        }
        Insert: {
          channel_id: string
          consented_at?: string
          email: string
          fan_id: string
          id?: string
        }
        Update: {
          channel_id?: string
          consented_at?: string
          email?: string
          fan_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_signups_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_signups_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      fans: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          handles: Json
          id: string
          is_seed: boolean
          last_seen_at: string | null
          newsletter_opt_in: boolean
          normalized_email: string
          referral_code: string
          show_activity: boolean
          show_on_leaderboard: boolean
          status: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          handles?: Json
          id: string
          is_seed?: boolean
          last_seen_at?: string | null
          newsletter_opt_in?: boolean
          normalized_email: string
          referral_code?: string
          show_activity?: boolean
          show_on_leaderboard?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          handles?: Json
          id?: string
          is_seed?: boolean
          last_seen_at?: string | null
          newsletter_opt_in?: boolean
          normalized_email?: string
          referral_code?: string
          show_activity?: boolean
          show_on_leaderboard?: boolean
          status?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          channel_id: string
          code: string
          converted_at: string | null
          created_at: string
          flagged: boolean
          id: string
          invitee_fan_id: string
          inviter_fan_id: string
        }
        Insert: {
          channel_id: string
          code: string
          converted_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          invitee_fan_id: string
          inviter_fan_id: string
        }
        Update: {
          channel_id?: string
          code?: string
          converted_at?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          invitee_fan_id?: string
          inviter_fan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invitee_fan_id_fkey"
            columns: ["invitee_fan_id"]
            isOneToOne: true
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_fan_id_fkey"
            columns: ["inviter_fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      link_visits: {
        Row: {
          channel_id: string
          created_at: string
          fan_id: string | null
          id: string
          quest_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          fan_id?: string | null
          id?: string
          quest_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          fan_id?: string | null
          id?: string
          quest_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_visits_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_visits_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_visits_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          body: string | null
          channel_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_label: string | null
          link_url: string | null
          published_at: string
          sort_order: number
          title: string
        }
        Insert: {
          body?: string | null
          channel_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          sort_order?: number
          title: string
        }
        Update: {
          body?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_items_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_responses: {
        Row: {
          answers: Json
          created_at: string
          fan_id: string
          id: string
          period_key: string
          quest_id: string
          score: number | null
        }
        Insert: {
          answers: Json
          created_at?: string
          fan_id: string
          id?: string
          period_key?: string
          quest_id: string
          score?: number | null
        }
        Update: {
          answers?: Json
          created_at?: string
          fan_id?: string
          id?: string
          period_key?: string
          quest_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_responses_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_responses_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          channel_id: string
          config: Json
          created_at: string
          cta_label: string | null
          deadline: string | null
          description: string | null
          id: string
          link_url: string | null
          lock_min_xp: number
          repeat_rule: string
          sort_order: number
          status: string
          title: string
          type: string
          updated_at: string
          xp: number
        }
        Insert: {
          channel_id: string
          config?: Json
          created_at?: string
          cta_label?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          link_url?: string | null
          lock_min_xp?: number
          repeat_rule?: string
          sort_order?: number
          status?: string
          title: string
          type: string
          updated_at?: string
          xp?: number
        }
        Update: {
          channel_id?: string
          config?: Json
          created_at?: string
          cta_label?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          link_url?: string | null
          lock_min_xp?: number
          repeat_rule?: string
          sort_order?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          correct_index: number
          quest_id: string
          question_index: number
        }
        Insert: {
          correct_index: number
          quest_id: string
          question_index: number
        }
        Update: {
          correct_index?: number
          quest_id?: string
          question_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          created_at: string
          fan_id: string
          reward_id: string
        }
        Insert: {
          created_at?: string
          fan_id: string
          reward_id: string
        }
        Update: {
          created_at?: string
          fan_id?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_entries: {
        Row: {
          created_at: string
          fan_id: string
          reward_id: string
        }
        Insert: {
          created_at?: string
          fan_id: string
          reward_id: string
        }
        Update: {
          created_at?: string
          fan_id?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_entries_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_entries_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          body: string | null
          channel_id: string
          created_at: string
          delivery_payload: string | null
          delivery_type: string
          draw_ends_at: string | null
          id: string
          image_url: string | null
          min_lifetime_xp: number
          picked_at: string | null
          sort_order: number
          status: string
          stock: number | null
          title: string
          type: string
          winner_fan_id: string | null
        }
        Insert: {
          body?: string | null
          channel_id: string
          created_at?: string
          delivery_payload?: string | null
          delivery_type?: string
          draw_ends_at?: string | null
          id?: string
          image_url?: string | null
          min_lifetime_xp?: number
          picked_at?: string | null
          sort_order?: number
          status?: string
          stock?: number | null
          title: string
          type: string
          winner_fan_id?: string | null
        }
        Update: {
          body?: string | null
          channel_id?: string
          created_at?: string
          delivery_payload?: string | null
          delivery_type?: string
          draw_ends_at?: string | null
          id?: string
          image_url?: string | null
          min_lifetime_xp?: number
          picked_at?: string | null
          sort_order?: number
          status?: string
          stock?: number | null
          title?: string
          type?: string
          winner_fan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_winner_fan_id_fkey"
            columns: ["winner_fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          caption: string | null
          channel_id: string
          consent_featured: boolean
          consent_rights: boolean
          created_at: string
          fan_id: string
          featured_at: string | null
          file_sha256: string | null
          handle: string | null
          hidden_at: string | null
          id: string
          image_path: string | null
          kind: string
          link_normalized: string | null
          link_url: string | null
          order_number: string | null
          quest_id: string
          reject_mode: string | null
          reject_note: string | null
          reject_reason: string | null
          removed_at: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          xp_awarded: boolean
        }
        Insert: {
          caption?: string | null
          channel_id: string
          consent_featured?: boolean
          consent_rights?: boolean
          created_at?: string
          fan_id: string
          featured_at?: string | null
          file_sha256?: string | null
          handle?: string | null
          hidden_at?: string | null
          id?: string
          image_path?: string | null
          kind: string
          link_normalized?: string | null
          link_url?: string | null
          order_number?: string | null
          quest_id: string
          reject_mode?: string | null
          reject_note?: string | null
          reject_reason?: string | null
          removed_at?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          xp_awarded?: boolean
        }
        Update: {
          caption?: string | null
          channel_id?: string
          consent_featured?: boolean
          consent_rights?: boolean
          created_at?: string
          fan_id?: string
          featured_at?: string | null
          file_sha256?: string | null
          handle?: string | null
          hidden_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          link_normalized?: string | null
          link_url?: string | null
          order_number?: string | null
          quest_id?: string
          reject_mode?: string | null
          reject_note?: string | null
          reject_reason?: string | null
          removed_at?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          xp_awarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "submissions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_ledger: {
        Row: {
          channel_id: string
          created_at: string
          fan_id: string
          id: string
          note: string | null
          period_key: string
          quest_id: string | null
          ref_id: string | null
          ref_type: string | null
          source: string
          xp: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          fan_id: string
          id?: string
          note?: string | null
          period_key?: string
          quest_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          source: string
          xp: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          fan_id?: string
          id?: string
          note?: string | null
          period_key?: string
          quest_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          source?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _award_xp: {
        Args: {
          p_channel: string
          p_fan: string
          p_note: string
          p_period_key: string
          p_quest: string
          p_ref_id?: string
          p_ref_type?: string
          p_source: string
          p_xp: number
        }
        Returns: boolean
      }
      _open_quest: {
        Args: { p_fan: string; p_quest: string }
        Returns: {
          channel_id: string
          config: Json
          created_at: string
          cta_label: string | null
          deadline: string | null
          description: string | null
          id: string
          link_url: string | null
          lock_min_xp: number
          repeat_rule: string
          sort_order: number
          status: string
          title: string
          type: string
          updated_at: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "quests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _window_start: {
        Args: { p_period: string; p_tz: string }
        Returns: string
      }
      activity_feed: {
        Args: { p_channel: string; p_limit?: number }
        Returns: {
          created_at: string
          display_name: string
          id: string
          note: string
          source: string
          xp: number
        }[]
      }
      adjust_xp: {
        Args: {
          p_channel: string
          p_fan: string
          p_reason: string
          p_xp: number
        }
        Returns: Json
      }
      admin_can_see_fan: { Args: { p_fan: string }; Returns: boolean }
      admin_channel_fan_count: { Args: { p_channel: string }; Returns: number }
      admin_channel_fans: {
        Args: { p_channel: string; p_limit?: number; p_q?: string }
        Returns: {
          created_at: string
          display_name: string | null
          email: string
          handles: Json
          id: string
          is_seed: boolean
          last_seen_at: string | null
          newsletter_opt_in: boolean
          normalized_email: string
          referral_code: string
          show_activity: boolean
          show_on_leaderboard: boolean
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "fans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_rewards: {
        Args: { p_channel: string }
        Returns: {
          body: string | null
          channel_id: string
          created_at: string
          delivery_payload: string | null
          delivery_type: string
          draw_ends_at: string | null
          id: string
          image_url: string | null
          min_lifetime_xp: number
          picked_at: string | null
          sort_order: number
          status: string
          stock: number | null
          title: string
          type: string
          winner_fan_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "rewards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      approve_submission: { Args: { p_id: string }; Returns: Json }
      assert_fan: {
        Args: { p_fan: string }
        Returns: {
          created_at: string
          display_name: string | null
          email: string
          handles: Json
          id: string
          is_seed: boolean
          last_seen_at: string | null
          newsletter_opt_in: boolean
          normalized_email: string
          referral_code: string
          show_activity: boolean
          show_on_leaderboard: boolean
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "fans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_invite: {
        Args: { p_channel: string; p_code: string }
        Returns: Json
      }
      channel_stats: { Args: { p_channel: string }; Returns: Json }
      chat_recent: {
        Args: { p_before?: string; p_channel: string; p_limit?: number }
        Returns: {
          body: string
          created_at: string
          display_name: string
          fan_id: string
          id: string
          is_admin: boolean
        }[]
      }
      check_in: { Args: { p_channel_slug: string }; Returns: Json }
      claim_reward: { Args: { p_reward: string }; Returns: Json }
      create_submission: {
        Args: {
          p_caption?: string
          p_consent_featured?: boolean
          p_consent_rights?: boolean
          p_handle?: string
          p_image_path?: string
          p_kind: string
          p_link_normalized?: string
          p_link_url?: string
          p_order_number?: string
          p_quest: string
          p_sha256?: string
        }
        Returns: Json
      }
      delete_chat_message: { Args: { p_id: string }; Returns: boolean }
      enter_draw: { Args: { p_reward: string }; Returns: Json }
      fan_active_in_channel: {
        Args: { p_channel: string; p_fan: string }
        Returns: boolean
      }
      fan_total_xp: {
        Args: { p_channel: string; p_fan: string }
        Returns: number
      }
      fans_online: { Args: { p_channel: string }; Returns: number }
      is_admin: { Args: { p_channel: string }; Returns: boolean }
      join_email_list: { Args: { p_channel: string }; Returns: Json }
      leaderboard: {
        Args: {
          p_channel: string
          p_limit?: number
          p_offset?: number
          p_period: string
        }
        Returns: {
          display_name: string
          fan_id: string
          rank: number
          xp: number
        }[]
      }
      moderate_upload: {
        Args: { p_action: string; p_id: string; p_reason?: string }
        Returns: Json
      }
      my_claims: {
        Args: { p_channel: string }
        Returns: {
          created_at: string
          delivery_payload: string
          delivery_type: string
          reward_id: string
        }[]
      }
      my_rank: { Args: { p_channel: string; p_period: string }; Returns: Json }
      normalize_email: { Args: { p_email: string }; Returns: string }
      normalize_social_link: { Args: { p_url: string }; Returns: string }
      period_key_for: {
        Args: { p_at?: string; p_item?: string; p_rule: string; p_tz: string }
        Returns: string
      }
      pick_winner: { Args: { p_reward: string }; Returns: Json }
      post_chat_message: {
        Args: { p_body: string; p_channel_slug: string }
        Returns: Json
      }
      record_link_visit: { Args: { p_quest: string }; Returns: Json }
      reject_submission: {
        Args: { p_id: string; p_mode: string; p_note: string; p_reason: string }
        Returns: Json
      }
      reward_stats: {
        Args: { p_channel: string }
        Returns: {
          claims: number
          entries: number
          reward_id: string
          winner_name: string
        }[]
      }
      set_fan_status: {
        Args: { p_channel: string; p_fan: string; p_status: string }
        Returns: Json
      }
      set_quiz_answers: {
        Args: { p_answers: number[]; p_quest: string }
        Returns: Json
      }
      submit_response: {
        Args: { p_answers: Json; p_quest: string }
        Returns: Json
      }
      touch_presence: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const
