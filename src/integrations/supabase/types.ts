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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          priority: string
          target_role: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          target_role?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          target_role?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          notes: string | null
          status: string
          student_profile_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          student_profile_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          student_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_document_patterns: {
        Row: {
          bank_name: string
          created_at: string
          id: string
          id_regex: string
          sample_reference: string | null
          swift_code: string
          transaction_id_format: string
          updated_at: string
        }
        Insert: {
          bank_name: string
          created_at?: string
          id?: string
          id_regex: string
          sample_reference?: string | null
          swift_code: string
          transaction_id_format: string
          updated_at?: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          id?: string
          id_regex?: string
          sample_reference?: string | null
          swift_code?: string
          transaction_id_format?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          id: string
          ip_address: string
          last_active_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          id?: string
          ip_address: string
          last_active_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          id?: string
          ip_address?: string
          last_active_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fee_requirements: {
        Row: {
          amount: number
          beginner_only: boolean
          category: string
          created_at: string
          currency: string
          form_levels: string[]
          gender: string
          id: string
          is_active: boolean
          item_name: string
          learning_area: string | null
          notes: string | null
          returning_only: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          beginner_only?: boolean
          category?: string
          created_at?: string
          currency?: string
          form_levels?: string[]
          gender?: string
          id?: string
          is_active?: boolean
          item_name: string
          learning_area?: string | null
          notes?: string | null
          returning_only?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          beginner_only?: boolean
          category?: string
          created_at?: string
          currency?: string
          form_levels?: string[]
          gender?: string
          id?: string
          is_active?: boolean
          item_name?: string
          learning_area?: string | null
          notes?: string | null
          returning_only?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          deposit_slip_url: string | null
          description: string | null
          id: string
          method: string
          paynow_reference: string | null
          phone: string | null
          poll_url: string | null
          receipt_number: string | null
          status: string
          student_profile_id: string
          updated_at: string
          verification_hash: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          deposit_slip_url?: string | null
          description?: string | null
          id?: string
          method: string
          paynow_reference?: string | null
          phone?: string | null
          poll_url?: string | null
          receipt_number?: string | null
          status?: string
          student_profile_id: string
          updated_at?: string
          verification_hash?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          deposit_slip_url?: string | null
          description?: string | null
          id?: string
          method?: string
          paynow_reference?: string | null
          phone?: string | null
          poll_url?: string | null
          receipt_number?: string | null
          status?: string
          student_profile_id?: string
          updated_at?: string
          verification_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_roster"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number
          claimed: boolean
          created_at: string
          first_name: string
          form: string | null
          gender: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_beginner: boolean
          last_name: string
          registration_number: string
          status: string
          stream: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: number
          claimed?: boolean
          created_at?: string
          first_name: string
          form?: string | null
          gender?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_beginner?: boolean
          last_name: string
          registration_number: string
          status?: string
          stream?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: number
          claimed?: boolean
          created_at?: string
          first_name?: string
          form?: string | null
          gender?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_beginner?: boolean
          last_name?: string
          registration_number?: string
          status?: string
          stream?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_roster: {
        Row: {
          first_name: string | null
          form: string | null
          id: string | null
          last_name: string | null
          registration_number: string | null
          status: string | null
          stream: string | null
        }
        Insert: {
          first_name?: string | null
          form?: string | null
          id?: string | null
          last_name?: string | null
          registration_number?: string | null
          status?: string | null
          stream?: string | null
        }
        Update: {
          first_name?: string | null
          form?: string | null
          id?: string | null
          last_name?: string | null
          registration_number?: string | null
          status?: string | null
          stream?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_student_fee_summary: {
        Args: never
        Returns: {
          balance: number
          payment_status: string
          profile_id: string
          total_fees: number
          total_paid: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_document_fingerprint: {
        Args: {
          p_amount: string
          p_bank_name: string
          p_swift_code: string
          p_transaction_id_format: string
        }
        Returns: {
          match_found: boolean
          matching_payment_id: string
          matching_receipt_number: string
          matching_student: string
        }[]
      }
      verify_payment_hash: {
        Args: {
          p_amount: string
          p_created_at: string
          p_receipt_number: string
          p_stored_hash: string
          p_student_profile_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student" | "teacher"
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
      app_role: ["admin", "student", "teacher"],
    },
  },
} as const
