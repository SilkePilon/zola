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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_attachments: {
        Row: {
          chat_id: string
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          id: string
          model: string | null
          pinned: boolean | null
          pinned_at: string | null
          project_id: string | null
          public: boolean | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          model?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          project_id?: string | null
          public?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          project_id?: string | null
          public?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_models: {
        Row: {
          audio: boolean | null
          base_url: string | null
          context_window: number | null
          created_at: string | null
          id: string
          input_cost: number | null
          model_id: string
          name: string
          output_cost: number | null
          provider_id: string
          reasoning: boolean | null
          tools: boolean | null
          updated_at: string | null
          user_id: string
          video: boolean | null
          vision: boolean | null
        }
        Insert: {
          audio?: boolean | null
          base_url?: string | null
          context_window?: number | null
          created_at?: string | null
          id?: string
          input_cost?: number | null
          model_id: string
          name: string
          output_cost?: number | null
          provider_id: string
          reasoning?: boolean | null
          tools?: boolean | null
          updated_at?: string | null
          user_id: string
          video?: boolean | null
          vision?: boolean | null
        }
        Update: {
          audio?: boolean | null
          base_url?: string | null
          context_window?: number | null
          created_at?: string | null
          id?: string
          input_cost?: number | null
          model_id?: string
          name?: string
          output_cost?: number | null
          provider_id?: string
          reasoning?: boolean | null
          tools?: boolean | null
          updated_at?: string | null
          user_id?: string
          video?: boolean | null
          vision?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      model_usage: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          input_cost_per_million: number | null
          input_cost_usd: number | null
          input_tokens: number
          message_id: number | null
          model_id: string
          output_cost_per_million: number | null
          output_cost_usd: number | null
          output_tokens: number
          provider_id: string
          total_cost_usd: number | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          input_cost_per_million?: number | null
          input_cost_usd?: number | null
          input_tokens?: number
          message_id?: number | null
          model_id: string
          output_cost_per_million?: number | null
          output_cost_usd?: number | null
          output_tokens?: number
          provider_id: string
          total_cost_usd?: number | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          input_cost_per_million?: number | null
          input_cost_usd?: number | null
          input_tokens?: number
          message_id?: number | null
          model_id?: string
          output_cost_per_million?: number | null
          output_cost_usd?: number | null
          output_tokens?: number
          provider_id?: string
          total_cost_usd?: number | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_usage_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alerts: {
        Row: {
          acknowledged: boolean | null
          alert_type: string
          amount_spent: number | null
          budget_limit: number | null
          budget_type: string
          created_at: string | null
          id: string
          message: string | null
          threshold_percent: number | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          alert_type: string
          amount_spent?: number | null
          budget_limit?: number | null
          budget_type: string
          created_at?: string | null
          id?: string
          message?: string | null
          threshold_percent?: number | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          alert_type?: string
          amount_spent?: number | null
          budget_limit?: number | null
          budget_type?: string
          created_at?: string | null
          id?: string
          message?: string | null
          threshold_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_limits: {
        Row: {
          created_at: string | null
          current_day_spend: number | null
          current_month_spend: number | null
          daily_budget_usd: number | null
          day_reset: string | null
          email_notifications: boolean | null
          enforce_limits: boolean | null
          id: string
          in_app_notifications: boolean | null
          monthly_budget_usd: number | null
          month_reset: string | null
          per_chat_budget_usd: number | null
          provider_id: string | null
          updated_at: string | null
          user_id: string
          warning_threshold_percent: number | null
        }
        Insert: {
          created_at?: string | null
          current_day_spend?: number | null
          current_month_spend?: number | null
          daily_budget_usd?: number | null
          day_reset?: string | null
          email_notifications?: boolean | null
          enforce_limits?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          monthly_budget_usd?: number | null
          month_reset?: string | null
          per_chat_budget_usd?: number | null
          provider_id?: string | null
          updated_at?: string | null
          user_id: string
          warning_threshold_percent?: number | null
        }
        Update: {
          created_at?: string | null
          current_day_spend?: number | null
          current_month_spend?: number | null
          daily_budget_usd?: number | null
          day_reset?: string | null
          email_notifications?: boolean | null
          enforce_limits?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          monthly_budget_usd?: number | null
          month_reset?: string | null
          per_chat_budget_usd?: number | null
          provider_id?: string | null
          updated_at?: string | null
          user_id?: string
          warning_threshold_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          args: Json | null
          auth_type: string | null
          bearer_token: string | null
          command: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          env: Json | null
          headers: Json | null
          id: string
          name: string
          oauth_config: Json | null
          transport_type: string
          updated_at: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          args?: Json | null
          auth_type?: string | null
          bearer_token?: string | null
          command?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          env?: Json | null
          headers?: Json | null
          id?: string
          name: string
          oauth_config?: Json | null
          transport_type: string
          updated_at?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          args?: Json | null
          auth_type?: string | null
          bearer_token?: string | null
          command?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          env?: Json | null
          headers?: Json | null
          id?: string
          name?: string
          oauth_config?: Json | null
          transport_type?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string | null
          experimental_attachments: Json | null
          id: number
          message_group_id: string | null
          model: string | null
          parts: Json | null
          role: Database["public"]["Enums"]["message_role"]
          user_id: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string | null
          experimental_attachments?: Json | null
          id?: number
          message_group_id?: string | null
          model?: string | null
          parts?: Json | null
          role: Database["public"]["Enums"]["message_role"]
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string | null
          experimental_attachments?: Json | null
          id?: number
          message_group_id?: string | null
          model?: string | null
          parts?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          iv: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          iv: string
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          iv?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          hidden_models: string[] | null
          layout: string | null
          multi_model_enabled: boolean | null
          prompt_suggestions: boolean | null
          show_conversation_previews: boolean | null
          show_tool_invocations: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hidden_models?: string[] | null
          layout?: string | null
          multi_model_enabled?: boolean | null
          prompt_suggestions?: boolean | null
          show_conversation_previews?: boolean | null
          show_tool_invocations?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          hidden_models?: string[] | null
          layout?: string | null
          multi_model_enabled?: boolean | null
          prompt_suggestions?: boolean | null
          show_conversation_previews?: boolean | null
          show_tool_invocations?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          daily_message_count: number | null
          daily_pro_message_count: number | null
          daily_pro_reset: string | null
          daily_reset: string | null
          display_name: string | null
          email: string
          favorite_models: string[] | null
          id: string
          last_active_at: string | null
          message_count: number | null
          premium: boolean | null
          profile_image: string | null
          system_prompt: string | null
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          daily_reset?: string | null
          display_name?: string | null
          email: string
          favorite_models?: string[] | null
          id: string
          last_active_at?: string | null
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          system_prompt?: string | null
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          daily_reset?: string | null
          display_name?: string | null
          email?: string
          favorite_models?: string[] | null
          id?: string
          last_active_at?: string | null
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          system_prompt?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      message_role: "system" | "user" | "assistant" | "data"
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
      message_role: ["system", "user", "assistant", "data"],
    },
  },
} as const
