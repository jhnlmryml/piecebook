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
      posts: {
        Row: {
          created_at: string
          id: string
          image: string[] | null
          likes_by: string[] | null
          post: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string[] | null
          likes_by?: string[] | null
          post?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string[] | null
          likes_by?: string[] | null
          post?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          image: string[] | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image?: string[] | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image?: string[] | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing: {
        Row: {
          category: string
          category_details: Json
          color: string | null
          condition: string
          created_at: string
          description: string
          id: string
          location: string
          material: string | null
          photos: string[]
          previous_price: number | null
          price: number
          quantity: number
          seller_id: string
          seller_email: string | null
          seller_name: string
          status: string
          title: string
        }
        Insert: {
          category: string
          category_details?: Json
          color?: string | null
          condition: string
          created_at?: string
          description: string
          id?: string
          location: string
          material?: string | null
          photos?: string[]
          previous_price?: number | null
          price: number
          quantity?: number
          seller_id: string
          seller_email?: string | null
          seller_name: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          category_details?: Json
          color?: string | null
          condition?: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          material?: string | null
          photos?: string[]
          previous_price?: number | null
          price?: number
          quantity?: number
          seller_id?: string
          seller_email?: string | null
          seller_name?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_id: string
          buyer_image: string | null
          buyer_location: string | null
          buyer_name: string
          buyer_role: string | null
          created_at: string
          id: string
          listing_category: string
          listing_category_details: Json
          listing_color: string | null
          listing_condition: string
          listing_description: string
          listing_location: string
          listing_material: string | null
          listing_photos: string[]
          listing_previous_price: number | null
          listing_id: string | null
          listing_title: string
          quantity: number
          seller_id: string
          seller_image: string | null
          seller_location: string | null
          seller_name: string
          seller_role: string | null
          source_listing_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          buyer_id: string
          buyer_image?: string | null
          buyer_location?: string | null
          buyer_name: string
          buyer_role?: string | null
          created_at?: string
          id?: string
          listing_category?: string
          listing_category_details?: Json
          listing_color?: string | null
          listing_condition?: string
          listing_description?: string
          listing_location?: string
          listing_material?: string | null
          listing_photos?: string[]
          listing_previous_price?: number | null
          listing_id?: string | null
          listing_title: string
          quantity: number
          seller_id: string
          seller_image?: string | null
          seller_location?: string | null
          seller_name: string
          seller_role?: string | null
          source_listing_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          buyer_id?: string
          buyer_image?: string | null
          buyer_location?: string | null
          buyer_name?: string
          buyer_role?: string | null
          created_at?: string
          id?: string
          listing_category?: string
          listing_category_details?: Json
          listing_color?: string | null
          listing_condition?: string
          listing_description?: string
          listing_location?: string
          listing_material?: string | null
          listing_photos?: string[]
          listing_previous_price?: number | null
          listing_id?: string | null
          listing_title?: string
          quantity?: number
          seller_id?: string
          seller_image?: string | null
          seller_location?: string | null
          seller_name?: string
          seller_role?: string | null
          source_listing_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing_like_archive: {
        Row: {
          created_at: string
          id: string
          source_listing_id: string
          source_like_id: string
          user_id: string
          user_image: string | null
          user_name: string
        }
        Insert: {
          created_at: string
          id?: string
          source_listing_id: string
          source_like_id: string
          user_id: string
          user_image?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          source_listing_id?: string
          source_like_id?: string
          user_id?: string
          user_image?: string | null
          user_name?: string
        }
        Relationships: []
      }
      marketplace_listing_comment_archive: {
        Row: {
          body: string
          created_at: string
          id: string
          image: string[] | null
          source_comment_id: string
          source_listing_id: string
          user_id: string
          user_image: string | null
          user_name: string
        }
        Insert: {
          body: string
          created_at: string
          id?: string
          image?: string[] | null
          source_comment_id: string
          source_listing_id: string
          user_id: string
          user_image?: string | null
          user_name: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image?: string[] | null
          source_comment_id?: string
          source_listing_id?: string
          user_id?: string
          user_image?: string | null
          user_name?: string
        }
        Relationships: []
      }
      marketplace_listing_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          image: string[] | null
          listing_id: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          image?: string[] | null
          listing_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image?: string[] | null
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing_likes: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          listing_id: string | null
          marketplace_order_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          listing_id?: string | null
          marketplace_order_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          listing_id?: string | null
          marketplace_order_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_marketplace_order_id_fkey"
            columns: ["marketplace_order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hidden_for: {
        Row: {
          created_at: string
          message_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hidden_for_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hidden_for_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_conversation_preferences: {
        Row: {
          archived: boolean
          created_at: string
          deleted_before: string | null
          partner_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          deleted_before?: string | null
          partner_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          deleted_before?: string | null
          partner_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_conversation_preferences_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_conversation_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          about: string | null
          birthdate: string | null
          created_at: string
          dream: string | null
          email: string | null
          full_name: string | null
          id: string
          image: string | null
          interests: string[] | null
          location: string | null
          role: string | null
        }
        Insert: {
          about?: string | null
          birthdate?: string | null
          created_at?: string
          dream?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          image?: string | null
          interests?: string[] | null
          location?: string | null
          role?: string | null
        }
        Update: {
          about?: string | null
          birthdate?: string | null
          created_at?: string
          dream?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          image?: string | null
          interests?: string[] | null
          location?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      marketplace_listing_engagement_counts: {
        Row: {
          comment_count: number
          like_count: number
          listing_id: string
        }
        Relationships: []
      }
    }
    Functions: {
      set_post_like: {
        Args: {
          requested_post_id: string
          requested_profile_id: string
          should_like: boolean
        }
        Returns: string[]
      }
      checkout_marketplace_listing: {
        Args: {
          requested_buyer_id: string
          requested_listing_id: string
          requested_quantity: number
        }
        Returns: Database["public"]["Tables"]["marketplace_orders"]["Row"]
      }
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
