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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_channel_settings: {
        Row: {
          created_at: string
          email_address: string | null
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          telegram_chat_id: string | null
          telegram_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string | null
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          channels: string[]
          coin_id: string | null
          condition: Json
          cooldown_minutes: number
          created_at: string
          id: string
          image: string | null
          is_active: boolean
          last_triggered_at: string | null
          name: string | null
          notes: string | null
          symbol: string | null
          trigger_count: number
          type: Database["public"]["Enums"]["alert_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          coin_id?: string | null
          condition?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string | null
          notes?: string | null
          symbol?: string | null
          trigger_count?: number
          type: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          coin_id?: string | null
          condition?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string | null
          notes?: string | null
          symbol?: string | null
          trigger_count?: number
          type?: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          amount: number
          buy_price: number
          coin_id: string
          created_at: string
          id: string
          image: string | null
          name: string
          portfolio_id: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          buy_price: number
          coin_id: string
          created_at?: string
          id?: string
          image?: string | null
          name: string
          portfolio_id?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          buy_price?: number
          coin_id?: string
          created_at?: string
          id?: string
          image?: string | null
          name?: string
          portfolio_id?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_id: string | null
          body: string
          coin_id: string | null
          created_at: string
          id: string
          image: string | null
          metadata: Json
          read_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          symbol: string | null
          title: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          body: string
          coin_id?: string | null
          created_at?: string
          id?: string
          image?: string | null
          metadata?: Json
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          symbol?: string | null
          title: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          body?: string
          coin_id?: string | null
          created_at?: string
          id?: string
          image?: string | null
          metadata?: Json
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          symbol?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          color: string
          created_at: string
          goal_amount: number | null
          goal_note: string | null
          goal_target_date: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          goal_amount?: number | null
          goal_note?: string | null
          goal_target_date?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          goal_amount?: number | null
          goal_note?: string | null
          goal_target_date?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          coin_id: string
          created_at: string
          executed_at: string
          fee: number
          id: string
          image: string | null
          name: string
          notes: string | null
          portfolio_id: string | null
          price: number
          side: Database["public"]["Enums"]["tx_side"]
          symbol: string
          user_id: string
        }
        Insert: {
          amount: number
          coin_id: string
          created_at?: string
          executed_at?: string
          fee?: number
          id?: string
          image?: string | null
          name: string
          notes?: string | null
          portfolio_id?: string | null
          price: number
          side: Database["public"]["Enums"]["tx_side"]
          symbol: string
          user_id: string
        }
        Update: {
          amount?: number
          coin_id?: string
          created_at?: string
          executed_at?: string
          fee?: number
          id?: string
          image?: string | null
          name?: string
          notes?: string | null
          portfolio_id?: string | null
          price?: number
          side?: Database["public"]["Enums"]["tx_side"]
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          coin_id: string
          created_at: string
          id: string
          image: string | null
          name: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          coin_id: string
          created_at?: string
          id?: string
          image?: string | null
          name?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          coin_id?: string
          created_at?: string
          id?: string
          image?: string | null
          name?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "success" | "warning" | "critical"
      alert_type:
        | "price_above"
        | "price_below"
        | "pct_change"
        | "volume_spike"
        | "volatility"
        | "market_crash"
        | "market_pump"
        | "news_keyword"
        | "watchlist_change"
      app_role: "admin" | "user"
      tx_side: "buy" | "sell"
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
      alert_severity: ["info", "success", "warning", "critical"],
      alert_type: [
        "price_above",
        "price_below",
        "pct_change",
        "volume_spike",
        "volatility",
        "market_crash",
        "market_pump",
        "news_keyword",
        "watchlist_change",
      ],
      app_role: ["admin", "user"],
      tx_side: ["buy", "sell"],
    },
  },
} as const
