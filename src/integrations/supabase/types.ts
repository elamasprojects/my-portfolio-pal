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
      achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discipline_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          rule_type: string
          rule_value: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          rule_type: string
          rule_value?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          rule_type?: string
          rule_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["follow_status"]
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["follow_status"]
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["follow_status"]
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_members: {
        Row: {
          id: string
          invited_at: string
          joined_at: string | null
          leaderboard_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          leaderboard_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          leaderboard_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_members_leaderboard_id_fkey"
            columns: ["leaderboard_id"]
            isOneToOne: false
            referencedRelation: "leaderboards"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          read: boolean
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      shared_exports: {
        Row: {
          created_at: string
          id: string
          image_url: string
          portfolio_name: string
          stats_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          portfolio_name: string
          stats_json?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          portfolio_name?: string
          stats_json?: Json
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_tag_assignments: {
        Row: {
          tag_id: string
          trade_id: string
        }
        Insert: {
          tag_id: string
          trade_id: string
        }
        Update: {
          tag_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "trade_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_tag_assignments_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          id: string
          notes: string | null
          original_currency: string
          original_price: number | null
          portfolio_id: string
          price_per_unit: number
          quantity: number
          strategy_id: string | null
          symbol: string
          total_amount: number | null
          trade_date: string
          trade_type: Database["public"]["Enums"]["trade_type"]
          user_id: string
        }
        Insert: {
          asset_name: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          notes?: string | null
          original_currency?: string
          original_price?: number | null
          portfolio_id: string
          price_per_unit: number
          quantity: number
          strategy_id?: string | null
          symbol: string
          total_amount?: number | null
          trade_date?: string
          trade_type?: Database["public"]["Enums"]["trade_type"]
          user_id: string
        }
        Update: {
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          notes?: string | null
          original_currency?: string
          original_price?: number | null
          portfolio_id?: string
          price_per_unit?: number
          quantity?: number
          strategy_id?: string | null
          symbol?: string
          total_amount?: number | null
          trade_date?: string
          trade_type?: Database["public"]["Enums"]["trade_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard_rankings: {
        Args: { _leaderboard_id: string }
        Returns: Json
      }
      get_player_summary: {
        Args: { _requester_id: string; _target_username: string }
        Returns: Json
      }
      get_player_summary_by_id: {
        Args: { _requester_id: string; _target_id: string }
        Returns: Json
      }
      is_connected_to: {
        Args: { _other_id: string; _user_id: string }
        Returns: boolean
      }
      is_leaderboard_creator: {
        Args: { _leaderboard_id: string; _user_id: string }
        Returns: boolean
      }
      is_leaderboard_member: {
        Args: { _leaderboard_id: string; _user_id: string }
        Returns: boolean
      }
      owns_trade: {
        Args: { _trade_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_type: "stock" | "etf" | "crypto" | "bond" | "other"
      follow_status: "pending" | "accepted" | "declined"
      trade_type: "buy" | "sell" | "dividend"
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
      asset_type: ["stock", "etf", "crypto", "bond", "other"],
      follow_status: ["pending", "accepted", "declined"],
      trade_type: ["buy", "sell", "dividend"],
    },
  },
} as const
