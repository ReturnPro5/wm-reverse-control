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
      fee_metrics: {
        Row: {
          check_in_fee: number | null
          created_at: string
          facility: string | null
          file_upload_id: string | null
          id: string
          marketplace_fee: number | null
          packaging_fee: number | null
          pick_pack_ship_fee: number | null
          program_name: string | null
          refurbishing_fee: number | null
          total_fees: number | null
          trgid: string
          wm_week: number | null
        }
        Insert: {
          check_in_fee?: number | null
          created_at?: string
          facility?: string | null
          file_upload_id?: string | null
          id?: string
          marketplace_fee?: number | null
          packaging_fee?: number | null
          pick_pack_ship_fee?: number | null
          program_name?: string | null
          refurbishing_fee?: number | null
          total_fees?: number | null
          trgid: string
          wm_week?: number | null
        }
        Update: {
          check_in_fee?: number | null
          created_at?: string
          facility?: string | null
          file_upload_id?: string | null
          id?: string
          marketplace_fee?: number | null
          packaging_fee?: number | null
          pick_pack_ship_fee?: number | null
          program_name?: string | null
          refurbishing_fee?: number | null
          total_fees?: number | null
          trgid?: string
          wm_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_metrics_file_upload_id_fkey"
            columns: ["file_upload_id"]
            isOneToOne: false
            referencedRelation: "file_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      file_uploads: {
        Row: {
          created_at: string
          file_business_date: string
          file_name: string
          file_type: Database["public"]["Enums"]["file_type"]
          id: string
          processed: boolean | null
          row_count: number | null
          upload_timestamp: string
        }
        Insert: {
          created_at?: string
          file_business_date: string
          file_name: string
          file_type?: Database["public"]["Enums"]["file_type"]
          id?: string
          processed?: boolean | null
          row_count?: number | null
          upload_timestamp?: string
        }
        Update: {
          created_at?: string
          file_business_date?: string
          file_name?: string
          file_type?: Database["public"]["Enums"]["file_type"]
          id?: string
          processed?: boolean | null
          row_count?: number | null
          upload_timestamp?: string
        }
        Relationships: []
      }
      lifecycle_events: {
        Row: {
          created_at: string
          event_date: string
          file_business_date: string
          file_upload_id: string | null
          id: string
          stage: Database["public"]["Enums"]["lifecycle_stage"]
          trgid: string
          wm_day_of_week: number | null
          wm_week: number | null
        }
        Insert: {
          created_at?: string
          event_date: string
          file_business_date: string
          file_upload_id?: string | null
          id?: string
          stage: Database["public"]["Enums"]["lifecycle_stage"]
          trgid: string
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Update: {
          created_at?: string
          event_date?: string
          file_business_date?: string
          file_upload_id?: string | null
          id?: string
          stage?: Database["public"]["Enums"]["lifecycle_stage"]
          trgid?: string
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_events_file_upload_id_fkey"
            columns: ["file_upload_id"]
            isOneToOne: false
            referencedRelation: "file_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_metrics: {
        Row: {
          b2c_auction: string | null
          category_name: string | null
          created_at: string
          discount_amount: number | null
          effective_retail: number | null
          expected_hv_as_is_refurb_fee: number | null
          facility: string | null
          file_upload_id: string | null
          gross_sale: number
          id: string
          invoiced_3pmp_fee: number | null
          invoiced_check_in_fee: number | null
          invoiced_marketing_fee: number | null
          invoiced_merchant_fee: number | null
          invoiced_overbox_fee: number | null
          invoiced_packaging_fee: number | null
          invoiced_pps_fee: number | null
          invoiced_refund_fee: number | null
          invoiced_refurb_fee: number | null
          invoiced_revshare_fee: number | null
          invoiced_shipping_fee: number | null
          is_refunded: boolean | null
          marketplace_profile_sold_on: string | null
          master_program_name: string | null
          order_closed_date: string
          program_name: string | null
          refund_amount: number | null
          sale_price: number
          service_invoice_total: number | null
          sorting_index: string | null
          tag_clientsource: string | null
          tag_ebay_auction_sale: boolean | null
          tag_pricing_condition: string | null
          trgid: string
          vendor_invoice_total: number | null
          wm_day_of_week: number | null
          wm_week: number | null
        }
        Insert: {
          b2c_auction?: string | null
          category_name?: string | null
          created_at?: string
          discount_amount?: number | null
          effective_retail?: number | null
          expected_hv_as_is_refurb_fee?: number | null
          facility?: string | null
          file_upload_id?: string | null
          gross_sale?: number
          id?: string
          invoiced_3pmp_fee?: number | null
          invoiced_check_in_fee?: number | null
          invoiced_marketing_fee?: number | null
          invoiced_merchant_fee?: number | null
          invoiced_overbox_fee?: number | null
          invoiced_packaging_fee?: number | null
          invoiced_pps_fee?: number | null
          invoiced_refund_fee?: number | null
          invoiced_refurb_fee?: number | null
          invoiced_revshare_fee?: number | null
          invoiced_shipping_fee?: number | null
          is_refunded?: boolean | null
          marketplace_profile_sold_on?: string | null
          master_program_name?: string | null
          order_closed_date: string
          program_name?: string | null
          refund_amount?: number | null
          sale_price?: number
          service_invoice_total?: number | null
          sorting_index?: string | null
          tag_clientsource?: string | null
          tag_ebay_auction_sale?: boolean | null
          tag_pricing_condition?: string | null
          trgid: string
          vendor_invoice_total?: number | null
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Update: {
          b2c_auction?: string | null
          category_name?: string | null
          created_at?: string
          discount_amount?: number | null
          effective_retail?: number | null
          expected_hv_as_is_refurb_fee?: number | null
          facility?: string | null
          file_upload_id?: string | null
          gross_sale?: number
          id?: string
          invoiced_3pmp_fee?: number | null
          invoiced_check_in_fee?: number | null
          invoiced_marketing_fee?: number | null
          invoiced_merchant_fee?: number | null
          invoiced_overbox_fee?: number | null
          invoiced_packaging_fee?: number | null
          invoiced_pps_fee?: number | null
          invoiced_refund_fee?: number | null
          invoiced_refurb_fee?: number | null
          invoiced_revshare_fee?: number | null
          invoiced_shipping_fee?: number | null
          is_refunded?: boolean | null
          marketplace_profile_sold_on?: string | null
          master_program_name?: string | null
          order_closed_date?: string
          program_name?: string | null
          refund_amount?: number | null
          sale_price?: number
          service_invoice_total?: number | null
          sorting_index?: string | null
          tag_clientsource?: string | null
          tag_ebay_auction_sale?: boolean | null
          tag_pricing_condition?: string | null
          trgid?: string
          vendor_invoice_total?: number | null
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_metrics_file_upload_id_fkey"
            columns: ["file_upload_id"]
            isOneToOne: false
            referencedRelation: "file_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      units_canonical: {
        Row: {
          category_name: string | null
          checked_in_on: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["lifecycle_stage"] | null
          discount_amount: number | null
          effective_retail: number | null
          facility: string | null
          file_upload_id: string | null
          first_listed_date: string | null
          id: string
          location_id: string | null
          marketplace_profile_sold_on: string | null
          master_program_name: string | null
          mr_lmr_upc_average_category_retail: number | null
          order_closed_date: string | null
          program_name: string | null
          received_on: string | null
          sale_price: number | null
          tag_client_ownership: string | null
          tag_clientsource: string | null
          tested_on: string | null
          trgid: string
          upc_retail: number | null
          updated_at: string
          wm_day_of_week: number | null
          wm_week: number | null
        }
        Insert: {
          category_name?: string | null
          checked_in_on?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          discount_amount?: number | null
          effective_retail?: number | null
          facility?: string | null
          file_upload_id?: string | null
          first_listed_date?: string | null
          id?: string
          location_id?: string | null
          marketplace_profile_sold_on?: string | null
          master_program_name?: string | null
          mr_lmr_upc_average_category_retail?: number | null
          order_closed_date?: string | null
          program_name?: string | null
          received_on?: string | null
          sale_price?: number | null
          tag_client_ownership?: string | null
          tag_clientsource?: string | null
          tested_on?: string | null
          trgid: string
          upc_retail?: number | null
          updated_at?: string
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Update: {
          category_name?: string | null
          checked_in_on?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["lifecycle_stage"] | null
          discount_amount?: number | null
          effective_retail?: number | null
          facility?: string | null
          file_upload_id?: string | null
          first_listed_date?: string | null
          id?: string
          location_id?: string | null
          marketplace_profile_sold_on?: string | null
          master_program_name?: string | null
          mr_lmr_upc_average_category_retail?: number | null
          order_closed_date?: string | null
          program_name?: string | null
          received_on?: string | null
          sale_price?: number | null
          tag_client_ownership?: string | null
          tag_clientsource?: string | null
          tested_on?: string | null
          trgid?: string
          upc_retail?: number | null
          updated_at?: string
          wm_day_of_week?: number | null
          wm_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "units_canonical_file_upload_id_fkey"
            columns: ["file_upload_id"]
            isOneToOne: false
            referencedRelation: "file_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      file_type:
        | "Sales"
        | "Inbound"
        | "Outbound"
        | "Inventory"
        | "Unknown"
        | "Production"
      lifecycle_stage: "Received" | "CheckedIn" | "Tested" | "Listed" | "Sold"
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
      file_type: [
        "Sales",
        "Inbound",
        "Outbound",
        "Inventory",
        "Unknown",
        "Production",
      ],
      lifecycle_stage: ["Received", "CheckedIn", "Tested", "Listed", "Sold"],
    },
  },
} as const
