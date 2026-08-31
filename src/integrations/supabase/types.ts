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
      email_accounts: {
        Row: {
          app_password: string
          connected_at: string | null
          created_at: string
          email_address: string
          last_checked_at: string | null
          last_error: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_password: string
          connected_at?: string | null
          created_at?: string
          email_address: string
          last_checked_at?: string | null
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_password?: string
          connected_at?: string | null
          created_at?: string
          email_address?: string
          last_checked_at?: string | null
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          merchant_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          merchant_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_domains_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          active: boolean
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          id: string
          name: string
          owner_id: string | null
          webhook_secret: string
        }
        Insert: {
          active?: boolean
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          webhook_secret: string
        }
        Update: {
          active?: boolean
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          webhook_secret?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          expiry_at: string
          failed_at: string | null
          failure_url: string | null
          last_webhook_at: string | null
          merchant_id: string | null
          merchant_order_id: string | null
          next_webhook_at: string | null
          order_id: string
          paid_at: string | null
          paid_email_id: string | null
          payable_amount: number
          payer_email: string | null
          payer_name: string | null
          requested_amount: number
          status: string
          success_url: string | null
          upi_pa: string | null
          upi_pn: string | null
          webhook_attempts: number
          webhook_status: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          expiry_at: string
          failed_at?: string | null
          failure_url?: string | null
          last_webhook_at?: string | null
          merchant_id?: string | null
          merchant_order_id?: string | null
          next_webhook_at?: string | null
          order_id: string
          paid_at?: string | null
          paid_email_id?: string | null
          payable_amount: number
          payer_email?: string | null
          payer_name?: string | null
          requested_amount: number
          status?: string
          success_url?: string | null
          upi_pa?: string | null
          upi_pn?: string | null
          webhook_attempts?: number
          webhook_status?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          expiry_at?: string
          failed_at?: string | null
          failure_url?: string | null
          last_webhook_at?: string | null
          merchant_id?: string | null
          merchant_order_id?: string | null
          next_webhook_at?: string | null
          order_id?: string
          paid_at?: string | null
          paid_email_id?: string | null
          payable_amount?: number
          payer_email?: string | null
          payer_name?: string | null
          requested_amount?: number
          status?: string
          success_url?: string | null
          upi_pa?: string | null
          upi_pn?: string | null
          webhook_attempts?: number
          webhook_status?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          archived_at: string
          created_at: string
          order_id: string
          paid_at: string
          paid_email_id: string | null
          payable_amount: number
          payer_email: string | null
          payer_name: string | null
          requested_amount: number
        }
        Insert: {
          archived_at?: string
          created_at: string
          order_id: string
          paid_at: string
          paid_email_id?: string | null
          payable_amount: number
          payer_email?: string | null
          payer_name?: string | null
          requested_amount: number
        }
        Update: {
          archived_at?: string
          created_at?: string
          order_id?: string
          paid_at?: string
          paid_email_id?: string | null
          payable_amount?: number
          payer_email?: string | null
          payer_name?: string | null
          requested_amount?: number
        }
        Relationships: []
      }
      processed_emails: {
        Row: {
          message_id: string
          order_id: string | null
          processed_at: string
        }
        Insert: {
          message_id: string
          order_id?: string | null
          processed_at?: string
        }
        Update: {
          message_id?: string
          order_id?: string | null
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          payee_name: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          payee_name?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          payee_name?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      profiles_revealed: {
        Row: {
          api_key_plain: string
          created_at: string
          user_id: string
        }
        Insert: {
          api_key_plain: string
          created_at?: string
          user_id: string
        }
        Update: {
          api_key_plain?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          error: string | null
          event: string
          id: string
          order_id: string
          response_body: string | null
          sent_at: string
          status_code: number | null
          url: string
        }
        Insert: {
          attempt: number
          error?: string | null
          event: string
          id?: string
          order_id: string
          response_body?: string | null
          sent_at?: string
          status_code?: number | null
          url: string
        }
        Update: {
          attempt?: number
          error?: string | null
          event?: string
          id?: string
          order_id?: string
          response_body?: string | null
          sent_at?: string
          status_code?: number | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      purge_daily_data: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
