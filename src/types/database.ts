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
      analysis: {
        Row: {
          analyzed_at: string | null
          approval_status: string | null
          caption: string | null
          content_status: string | null
          created_at: string | null
          explanation: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          metadata: Json | null
          pacing: Json | null
          quality_score: number | null
          raw_ai_response: Json | null
          segment_id: string
          status: string | null
          timestamps: Json | null
          updated_at: string | null
          virality_score: number | null
        }
        Insert: {
          analyzed_at?: string | null
          approval_status?: string | null
          caption?: string | null
          content_status?: string | null
          created_at?: string | null
          explanation?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          metadata?: Json | null
          pacing?: Json | null
          quality_score?: number | null
          raw_ai_response?: Json | null
          segment_id: string
          status?: string | null
          timestamps?: Json | null
          updated_at?: string | null
          virality_score?: number | null
        }
        Update: {
          analyzed_at?: string | null
          approval_status?: string | null
          caption?: string | null
          content_status?: string | null
          created_at?: string | null
          explanation?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          metadata?: Json | null
          pacing?: Json | null
          quality_score?: number | null
          raw_ai_response?: Json | null
          segment_id?: string
          status?: string | null
          timestamps?: Json | null
          updated_at?: string | null
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "clips_segmented"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_templates: {
        Row: {
          color_primary: string | null
          color_secondary: string | null
          created_at: string
          font: string | null
          id: string
          name: string
          overlay_path: string | null
          watermark_path: string | null
        }
        Insert: {
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string
          font?: string | null
          id?: string
          name?: string
          overlay_path?: string | null
          watermark_path?: string | null
        }
        Update: {
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string
          font?: string | null
          id?: string
          name?: string
          overlay_path?: string | null
          watermark_path?: string | null
        }
        Relationships: []
      }
      "brand_templates (for overlays, typography, watermark)": {
        Row: {
          color_primary: string | null
          color_secondary: string | null
          created_at: string
          font: string | null
          id: string
          name: string | null
          overlay_path: string | null
          watermark_path: string | null
        }
        Insert: {
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string
          font?: string | null
          id?: string
          name?: string | null
          overlay_path?: string | null
          watermark_path?: string | null
        }
        Update: {
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string
          font?: string | null
          id?: string
          name?: string | null
          overlay_path?: string | null
          watermark_path?: string | null
        }
        Relationships: []
      }

      clips_raw: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_path: string | null
          id: string
          source: string | null
          source_id: string | null
          status: string | null
        }
        Insert: {
          created_at: string
          duration_seconds?: number | null
          file_path?: string | null
          id?: string
          source?: string | null
          source_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_path?: string | null
          id?: string
          source?: string | null
          source_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      clips_segmented: {
        Row: {
          created_at: string
          duration_seconds: number | null
          end_time: number | null
          file_path: string | null
          id: string
          raw_clip_id: string | null
          start_time: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: number | null
          file_path?: string | null
          id?: string
          raw_clip_id?: string | null
          start_time?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          end_time?: number | null
          file_path?: string | null
          id?: string
          raw_clip_id?: string | null
          start_time?: number | null
          status?: string | null
        }
        Relationships: []
      }
      content_direction: {
        Row: {
          approval_level: string
          brand_alignment_score: number | null
          caption_clarity: number | null
          clip_id: string
          content_pillar: string | null
          content_relevance: number | null
          created_at: string | null
          created_by: string | null
          director_notes: string | null
          guidance_for_production: string | null
          hook_strength: number | null
          id: number
          quality_score: number
          sensationalism_score: number | null
          status: string
          updated_at: string | null
          validation_details: Json | null
          virality_score: number | null
        }
        Insert: {
          approval_level?: string
          brand_alignment_score?: number | null
          caption_clarity?: number | null
          clip_id: string
          content_pillar?: string | null
          content_relevance?: number | null
          created_at?: string | null
          created_by?: string | null
          director_notes?: string | null
          guidance_for_production?: string | null
          hook_strength?: number | null
          id?: number
          quality_score?: number
          sensationalism_score?: number | null
          status?: string
          updated_at?: string | null
          validation_details?: Json | null
          virality_score?: number | null
        }
        Update: {
          approval_level?: string
          brand_alignment_score?: number | null
          caption_clarity?: number | null
          clip_id?: string
          content_pillar?: string | null
          content_relevance?: number | null
          created_at?: string | null
          created_by?: string | null
          director_notes?: string | null
          guidance_for_production?: string | null
          hook_strength?: number | null
          id?: number
          quality_score?: number
          sensationalism_score?: number | null
          status?: string
          updated_at?: string | null
          validation_details?: Json | null
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_direction_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      error_log: {
        Row: {
          ai_analysis: Json | null
          assigned_to: string | null
          created_at: string | null
          entity_id: string
          entity_name: string
          error_message: string
          error_type: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          entity_id: string
          entity_name: string
          error_message: string
          error_type: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          error_message?: string
          error_type?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      posting_queue: {
        Row: {
          created_at: string
          final_video_id: string | null
          id: string
          platform: string | null
          posted_at: string | null
          scheduled_for: string | null
          status: string | null
        }
        Insert: {
          created_at: string
          final_video_id?: string | null
          id?: string
          platform?: string | null
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          final_video_id?: string | null
          id?: string
          platform?: string | null
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
        }
        Relationships: []
      }
      reference_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          metadata: Json | null
          pillar: string | null
          source: string
          source_id: string | null
          status: string
          title: string | null
          url: string | null
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          pillar?: string | null
          source: string
          source_id?: string | null
          status?: string
          title?: string | null
          url?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          pillar?: string | null
          source?: string
          source_id?: string | null
          status?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      remediation_log: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_name: string
          error_message: string
          error_type: string
          id: string
          manual_trigger: boolean | null
          remediation_action: string
          remediation_details: string | null
          remediation_success: boolean
          retry_recommended: boolean | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_name: string
          error_message: string
          error_type: string
          id?: string
          manual_trigger?: boolean | null
          remediation_action: string
          remediation_details?: string | null
          remediation_success: boolean
          retry_recommended?: boolean | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          error_message?: string
          error_type?: string
          id?: string
          manual_trigger?: boolean | null
          remediation_action?: string
          remediation_details?: string | null
          remediation_success?: boolean
          retry_recommended?: boolean | null
        }
        Relationships: []
      }
      review_tasks: {
        Row: {
          actual_review_time_minutes: number | null
          assigned_at: string | null
          assigned_to: string | null
          clip_id: string
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          estimated_review_time: number | null
          feedback: string | null
          id: number
          issues: Json
          issues_summary: string | null
          priority: string
          review_started_at: string | null
          revision_count: number | null
          revision_requested_reason: string | null
          stage: string
          updated_at: string | null
        }
        Insert: {
          actual_review_time_minutes?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          clip_id: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          estimated_review_time?: number | null
          feedback?: string | null
          id?: number
          issues?: Json
          issues_summary?: string | null
          priority?: string
          review_started_at?: string | null
          revision_count?: number | null
          revision_requested_reason?: string | null
          stage?: string
          updated_at?: string | null
        }
        Update: {
          actual_review_time_minutes?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          clip_id?: string
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          estimated_review_time?: number | null
          feedback?: string | null
          id?: number
          issues?: Json
          issues_summary?: string | null
          priority?: string
          review_started_at?: string | null
          revision_count?: number | null
          revision_requested_reason?: string | null
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_tasks_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      source_metadata: {
        Row: {
          clip_id: string | null
          created_at: string
          id: string
          raw_metadata: Json | null
          source_type: string | null
          transcript: string | null
        }
        Insert: {
          clip_id?: string | null
          created_at?: string
          id?: string
          raw_metadata?: Json | null
          source_type?: string | null
          transcript?: string | null
        }
        Update: {
          clip_id?: string | null
          created_at?: string
          id?: string
          raw_metadata?: Json | null
          source_type?: string | null
          transcript?: string | null
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string | null
          id: string
          message: string
          platform: string | null
          severity: string | null
          type: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          id?: string
          message: string
          platform?: string | null
          severity?: string | null
          type: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          id?: string
          message?: string
          platform?: string | null
          severity?: string | null
          type?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          event: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }

      video_performance: {
        Row: {
          avg_watch_percentage: number | null
          click_throughs: number | null
          comments: number | null
          conversions: number | null
          created_at: string | null
          engagement_count: number | null
          engagement_rate: number | null
          estimated_impact_score: number | null
          estimated_impressions: number | null
          estimated_reach: number | null
          id: number
          likes: number | null
          metrics_json: Json | null
          platform: string
          posted_at: string | null
          recorded_at: string | null
          shares: number | null
          updated_at: string | null
          video_id: string
          views: number | null
          watch_time_minutes: number | null
        }
        Insert: {
          avg_watch_percentage?: number | null
          click_throughs?: number | null
          comments?: number | null
          conversions?: number | null
          created_at?: string | null
          engagement_count?: number | null
          engagement_rate?: number | null
          estimated_impact_score?: number | null
          estimated_impressions?: number | null
          estimated_reach?: number | null
          id?: number
          likes?: number | null
          metrics_json?: Json | null
          platform: string
          posted_at?: string | null
          recorded_at?: string | null
          shares?: number | null
          updated_at?: string | null
          video_id: string
          views?: number | null
          watch_time_minutes?: number | null
        }
        Update: {
          avg_watch_percentage?: number | null
          click_throughs?: number | null
          comments?: number | null
          conversions?: number | null
          created_at?: string | null
          engagement_count?: number | null
          engagement_rate?: number | null
          estimated_impact_score?: number | null
          estimated_impressions?: number | null
          estimated_reach?: number | null
          id?: number
          likes?: number | null
          metrics_json?: Json | null
          platform?: string
          posted_at?: string | null
          recorded_at?: string | null
          shares?: number | null
          updated_at?: string | null
          video_id?: string
          views?: number | null
          watch_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_performance_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_final"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_final: {
        Row: {
          analysis_id: string
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          file_path: string
          has_subtitles: boolean | null
          id: string
          produced_at: string | null
          production_settings: Json | null
          segment_id: string
          status: string | null
          thumbnail_path: string | null
          updated_at: string | null
        }
        Insert: {
          analysis_id: string
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_path: string
          has_subtitles?: boolean | null
          id?: string
          produced_at?: string | null
          production_settings?: Json | null
          segment_id: string
          status?: string | null
          thumbnail_path?: string | null
          updated_at?: string | null
        }
        Update: {
          analysis_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_path?: string
          has_subtitles?: boolean | null
          id?: string
          produced_at?: string | null
          production_settings?: Json | null
          segment_id?: string
          status?: string | null
          thumbnail_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_final_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_final_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "clips_segmented"
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
