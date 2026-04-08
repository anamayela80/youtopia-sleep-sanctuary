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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      checkin_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          month: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          month: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          month?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      meditation_segments: {
        Row: {
          audio_url: string
          created_at: string
          id: string
          meditation_id: string
          segment_number: number
        }
        Insert: {
          audio_url: string
          created_at?: string
          id?: string
          meditation_id: string
          segment_number: number
        }
        Update: {
          audio_url?: string
          created_at?: string
          id?: string
          meditation_id?: string
          segment_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "meditation_segments_meditation_id_fkey"
            columns: ["meditation_id"]
            isOneToOne: false
            referencedRelation: "meditations"
            referencedColumns: ["id"]
          },
        ]
      }
      meditations: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          month: string
          music_mood: string
          music_url: string | null
          script: string
          theme_id: string | null
          title: string
          user_id: string
          voice_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          month: string
          music_mood: string
          music_url?: string | null
          script: string
          theme_id?: string | null
          title: string
          user_id: string
          voice_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          month?: string
          music_mood?: string
          music_url?: string | null
          script?: string
          theme_id?: string | null
          title?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meditations_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "monthly_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_themes: {
        Row: {
          checkin_count: number | null
          checkin_question: string | null
          created_at: string
          description: string | null
          guide_voice_id: string | null
          id: string
          intention: string | null
          is_active: boolean | null
          month: string
          music_file_url: string | null
          questions: Json | null
          theme: string
        }
        Insert: {
          checkin_count?: number | null
          checkin_question?: string | null
          created_at?: string
          description?: string | null
          guide_voice_id?: string | null
          id?: string
          intention?: string | null
          is_active?: boolean | null
          month: string
          music_file_url?: string | null
          questions?: Json | null
          theme: string
        }
        Update: {
          checkin_count?: number | null
          checkin_question?: string | null
          created_at?: string
          description?: string | null
          guide_voice_id?: string | null
          id?: string
          intention?: string | null
          is_active?: boolean | null
          month?: string
          music_file_url?: string | null
          questions?: Json | null
          theme?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          morning_reminder_time: string | null
          night_reminder_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          morning_reminder_time?: string | null
          night_reminder_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seeds: {
        Row: {
          audio_url_1: string | null
          audio_url_2: string | null
          audio_url_3: string | null
          audio_url_4: string | null
          audio_url_5: string | null
          created_at: string
          id: string
          month: string
          phrase_1: string
          phrase_2: string
          phrase_3: string
          phrase_4: string
          phrase_5: string
          theme_id: string | null
          user_id: string
        }
        Insert: {
          audio_url_1?: string | null
          audio_url_2?: string | null
          audio_url_3?: string | null
          audio_url_4?: string | null
          audio_url_5?: string | null
          created_at?: string
          id?: string
          month: string
          phrase_1: string
          phrase_2: string
          phrase_3: string
          phrase_4: string
          phrase_5: string
          theme_id?: string | null
          user_id: string
        }
        Update: {
          audio_url_1?: string | null
          audio_url_2?: string | null
          audio_url_3?: string | null
          audio_url_4?: string | null
          audio_url_5?: string | null
          created_at?: string
          id?: string
          month?: string
          phrase_1?: string
          phrase_2?: string
          phrase_3?: string
          phrase_4?: string
          phrase_5?: string
          theme_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seeds_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "monthly_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_answers: {
        Row: {
          created_at: string
          id: string
          question_1: string
          question_2: string
          question_3: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_1: string
          question_2: string
          question_3: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_1?: string
          question_2?: string
          question_3?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_voice_clones: {
        Row: {
          created_at: string
          elevenlabs_voice_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elevenlabs_voice_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          elevenlabs_voice_id?: string
          id?: string
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
