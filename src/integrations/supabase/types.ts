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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      crop_years: {
        Row: {
          created_at: string
          crop_end: string
          crop_start: string
          farm_id: string
          harvest_end: string
          harvest_start: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          crop_end: string
          crop_start: string
          farm_id: string
          harvest_end: string
          harvest_start: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          crop_end?: string
          crop_start?: string
          farm_id?: string
          harvest_end?: string
          harvest_start?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_years_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_managers: {
        Row: {
          farm_id: string
          id: string
          user_id: string
        }
        Insert: {
          farm_id: string
          id?: string
          user_id: string
        }
        Update: {
          farm_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_managers_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          company_id: string | null
          created_at: string
          fruit_id: string
          id: string
          name: string
          surface_m2: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          fruit_id: string
          id?: string
          name: string
          surface_m2?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          fruit_id?: string
          id?: string
          name?: string
          surface_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "farms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farms_fruit_id_fkey"
            columns: ["fruit_id"]
            isOneToOne: false
            referencedRelation: "fruits"
            referencedColumns: ["id"]
          },
        ]
      }
      fruits: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      labor_cost_rates: {
        Row: {
          created_at: string
          created_by: string | null
          hourly_rate: number
          id: string
          valid_from: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hourly_rate: number
          id?: string
          valid_from: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hourly_rate?: number
          id?: string
          valid_from?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          attachment_path: string | null
          category_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          farm_id: string
          id: string
          item: string
          purchase_date: string
          quantity: number
          supplier: string | null
          unit: string
        }
        Insert: {
          attachment_path?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          farm_id: string
          id?: string
          item: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Update: {
          attachment_path?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          farm_id?: string
          id?: string
          item?: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supply_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_types: {
        Row: {
          created_at: string
          hint: string | null
          id: string
          is_harvest: boolean
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          hint?: string | null
          id?: string
          is_harvest?: boolean
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          hint?: string | null
          id?: string
          is_harvest?: boolean
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          farm_id: string
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          farm_id: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          farm_id?: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
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
      varieties: {
        Row: {
          created_at: string
          fruit_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          fruit_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          fruit_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "varieties_fruit_id_fkey"
            columns: ["fruit_id"]
            isOneToOne: false
            referencedRelation: "fruits"
            referencedColumns: ["id"]
          },
        ]
      }
      work_hours: {
        Row: {
          created_at: string
          created_by: string | null
          crop_year_id: string | null
          farm_id: string
          hours: number
          id: string
          kg: number | null
          notes: string | null
          task_type: string
          updated_at: string
          updated_by: string | null
          variety: string | null
          work_date: string
          worker_id: string | null
          worker_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop_year_id?: string | null
          farm_id: string
          hours: number
          id?: string
          kg?: number | null
          notes?: string | null
          task_type: string
          updated_at?: string
          updated_by?: string | null
          variety?: string | null
          work_date?: string
          worker_id?: string | null
          worker_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop_year_id?: string | null
          farm_id?: string
          hours?: number
          id?: string
          kg?: number | null
          notes?: string | null
          task_type?: string
          updated_at?: string
          updated_by?: string | null
          variety?: string | null
          work_date?: string
          worker_id?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_hours_crop_year_id_fkey"
            columns: ["crop_year_id"]
            isOneToOne: false
            referencedRelation: "crop_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_hours_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_hours_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          active: boolean
          created_at: string
          farm_id: string
          id: string
          idrh: string | null
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          farm_id: string
          id?: string
          idrh?: string | null
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          farm_id?: string
          id?: string
          idrh?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_farm_access: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_crop_years: {
        Args: { p_farm_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager"
      task_status: "pendiente" | "en_curso" | "completada"
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
  public: {
    Enums: {
      app_role: ["admin", "manager"],
      task_status: ["pendiente", "en_curso", "completada"],
    },
  },
} as const
