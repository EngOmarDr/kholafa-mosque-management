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
      activities: {
        Row: {
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          points_awarded: number | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          points_awarded?: number | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          points_awarded?: number | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          activity_date: string
          activity_type: string | null
          changes: Json | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          activity_date?: string
          activity_type?: string | null
          changes?: Json | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          activity_date?: string
          activity_type?: string | null
          changes?: Json | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      analytics_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          data: Json
          expires_at: string
          id: string
          updated_at: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          data: Json
          expires_at: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          data?: Json
          expires_at?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          points: number | null
          recitation_quality: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          points?: number | null
          recitation_quality?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          points?: number | null
          recitation_quality?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_range_from: string | null
          date_range_to: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          status: string | null
          tables_included: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_range_from?: string | null
          date_range_to?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          tables_included?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_range_from?: string | null
          date_range_to?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          tables_included?: string[] | null
        }
        Relationships: []
      }
      bonus_points: {
        Row: {
          created_at: string | null
          date: string
          id: string
          points: number
          reason: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          points: number
          reason: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          points?: number
          reason?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      check_items: {
        Row: {
          active: boolean
          category: string | null
          created_at: string | null
          id: string
          name: string
          points: number
          points_brought: number | null
          points_lost: number | null
          points_not_brought: number | null
          points_skipped: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
          points?: number
          points_brought?: number | null
          points_lost?: number | null
          points_not_brought?: number | null
          points_skipped?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
          points?: number
          points_brought?: number | null
          points_lost?: number | null
          points_not_brought?: number | null
          points_skipped?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      check_records: {
        Row: {
          date: string
          id: string
          item_id: string
          points: number
          status: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          date?: string
          id?: string
          item_id: string
          points?: number
          status?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          date?: string
          id?: string
          item_id?: string
          points?: number
          status?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "check_items"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_name: string
          created_at: string | null
          id: string
          teacher_id: string | null
        }
        Insert: {
          class_name: string
          created_at?: string | null
          id?: string
          teacher_id?: string | null
        }
        Update: {
          class_name?: string
          created_at?: string | null
          id?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      competition_results: {
        Row: {
          achieved: boolean | null
          competition_id: string | null
          created_at: string | null
          id: string
          reward_given: boolean | null
          student_id: string | null
        }
        Insert: {
          achieved?: boolean | null
          competition_id?: string | null
          created_at?: string | null
          id?: string
          reward_given?: boolean | null
          student_id?: string | null
        }
        Update: {
          achieved?: boolean | null
          competition_id?: string | null
          created_at?: string | null
          id?: string
          reward_given?: boolean | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_results_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          conditions: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reward_type: string | null
          reward_value: number | null
          title: string
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reward_type?: string | null
          reward_value?: number | null
          title: string
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reward_type?: string | null
          reward_value?: number | null
          title?: string
        }
        Relationships: []
      }
      grade_promotions: {
        Row: {
          created_at: string | null
          details: Json
          id: string
          is_reverted: boolean | null
          performed_by: string | null
          promotion_date: string
          reverted_at: string | null
          reverted_by: string | null
          students_promoted: number
        }
        Insert: {
          created_at?: string | null
          details: Json
          id?: string
          is_reverted?: boolean | null
          performed_by?: string | null
          promotion_date?: string
          reverted_at?: string | null
          reverted_by?: string | null
          students_promoted: number
        }
        Update: {
          created_at?: string | null
          details?: Json
          id?: string
          is_reverted?: boolean | null
          performed_by?: string | null
          promotion_date?: string
          reverted_at?: string | null
          reverted_by?: string | null
          students_promoted?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_promotions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_promotions_reverted_by_fkey"
            columns: ["reverted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardianships: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string
          relation: string | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id: string
          relation?: string | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardianships_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardianships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          month: string
          report_type: string
          report_url: string | null
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          month: string
          report_type?: string
          report_url?: string | null
          user_id: string
          user_role: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          month?: string
          report_type?: string
          report_url?: string | null
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      mosques: {
        Row: {
          created_at: string | null
          id: string
          "اسم المسجد": string
        }
        Insert: {
          created_at?: string | null
          id?: string
          "اسم المسجد": string
        }
        Update: {
          created_at?: string | null
          id?: string
          "اسم المسجد"?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          target_role: string | null
          target_user_id: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          target_role?: string | null
          target_user_id?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          target_role?: string | null
          target_user_id?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      points_attendance: {
        Row: {
          attendance_status: string | null
          created_at: string | null
          date: string | null
          id: string
          memorized_pages: number | null
          score: number | null
          student_id: string | null
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          memorized_pages?: number | null
          score?: number | null
          student_id?: string | null
        }
        Update: {
          attendance_status?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          memorized_pages?: number | null
          score?: number | null
          student_id?: string | null
        }
        Relationships: []
      }
      points_balance: {
        Row: {
          attendance_points: number | null
          bonus_points: number | null
          id: string
          recitation_points: number | null
          student_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          attendance_points?: number | null
          bonus_points?: number | null
          id?: string
          recitation_points?: number | null
          student_id: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          attendance_points?: number | null
          bonus_points?: number | null
          id?: string
          recitation_points?: number | null
          student_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_balance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      points_settings: {
        Row: {
          category: string
          created_at: string | null
          id: string
          key: string
          label: string
          points: number
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          key: string
          label: string
          points?: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          key?: string
          label?: string
          points?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id: string
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          is_active: boolean | null
          subscription_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          subscription_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          subscription_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recitations: {
        Row: {
          created_at: string | null
          date: string
          id: string
          last_saved: string
          notes: string | null
          points_awarded: number | null
          rating: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          last_saved: string
          notes?: string | null
          points_awarded?: number | null
          rating: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          last_saved?: string
          notes?: string | null
          points_awarded?: number | null
          rating?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: []
      }
      student_teacher_history: {
        Row: {
          change_date: string | null
          id: string
          new_teacher: string | null
          old_teacher: string | null
          student_id: string | null
          updated_by: string | null
        }
        Insert: {
          change_date?: string | null
          id?: string
          new_teacher?: string | null
          old_teacher?: string | null
          student_id?: string | null
          updated_by?: string | null
        }
        Update: {
          change_date?: string | null
          id?: string
          new_teacher?: string | null
          old_teacher?: string | null
          student_id?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          created_at: string | null
          current_teacher: string | null
          father_name: string | null
          grade: string | null
          id: string
          mosque_name: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          previous_teacher: string | null
          received_tools: string[] | null
          registration_status: string | null
          social_status: string | null
          student_name: string
          teacher_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          current_teacher?: string | null
          father_name?: string | null
          grade?: string | null
          id?: string
          mosque_name?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          previous_teacher?: string | null
          received_tools?: string[] | null
          registration_status?: string | null
          social_status?: string | null
          student_name: string
          teacher_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          current_teacher?: string | null
          father_name?: string | null
          grade?: string | null
          id?: string
          mosque_name?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          previous_teacher?: string | null
          received_tools?: string[] | null
          registration_status?: string | null
          social_status?: string | null
          student_name?: string
          teacher_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students_profiles: {
        Row: {
          achievements: Json | null
          badges: Json | null
          created_at: string | null
          id: string
          last_memorization: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          achievements?: Json | null
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_memorization?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          achievements?: Json | null
          badges?: Json | null
          created_at?: string | null
          id?: string
          last_memorization?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_classes: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          supervisor_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          supervisor_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          survey_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          survey_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_activity_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_activity_logs_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          options: Json | null
          order_index: number
          parent_question_id: string | null
          points_config: Json | null
          question_text: string
          question_type: string
          show_if_answer: Json | null
          survey_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          order_index: number
          parent_question_id?: string | null
          points_config?: Json | null
          question_text: string
          question_type: string
          show_if_answer?: Json | null
          survey_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          order_index?: number
          parent_question_id?: string | null
          points_config?: Json | null
          question_text?: string
          question_type?: string
          show_if_answer?: Json | null
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_parent_question_id_fkey"
            columns: ["parent_question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          created_at: string | null
          id: string
          question_id: string | null
          response_value: Json
          submission_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id?: string | null
          response_value: Json
          submission_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string | null
          response_value?: Json
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "survey_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_submissions: {
        Row: {
          id: string
          ip_address: string | null
          score_max: number | null
          score_percentage: number | null
          score_raw: number | null
          status: string | null
          submitted_at: string | null
          survey_id: string | null
          teacher_id: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          score_max?: number | null
          score_percentage?: number | null
          score_raw?: number | null
          status?: string | null
          submitted_at?: string | null
          survey_id?: string | null
          teacher_id?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          score_max?: number | null
          score_percentage?: number | null
          score_raw?: number | null
          status?: string | null
          submitted_at?: string | null
          survey_id?: string | null
          teacher_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_submissions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          allow_edits: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          edit_limit_hours: number | null
          end_date: string | null
          id: string
          include_optional_in_scoring: boolean | null
          is_anonymous: boolean | null
          is_required: boolean | null
          scoring_type: string | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_edits?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edit_limit_hours?: number | null
          end_date?: string | null
          id?: string
          include_optional_in_scoring?: boolean | null
          is_anonymous?: boolean | null
          is_required?: boolean | null
          scoring_type?: string | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_edits?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          edit_limit_hours?: number | null
          end_date?: string | null
          id?: string
          include_optional_in_scoring?: boolean | null
          is_anonymous?: boolean | null
          is_required?: boolean | null
          scoring_type?: string | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_applications: {
        Row: {
          created_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          اسم_الاب: string | null
          اسم_الاستاذ: string
          اسم_الثانوية_الشرعية: string | null
          اسم_السجن_السابق: string | null
          اسم_المعلم_السابق: string | null
          الأحلام: string | null
          البريد_الالكتروني: string | null
          التحصيل_الدراسي: string | null
          الحالة_الاجتماعية: string | null
          الحالة_الصحية_والنفسية: string | null
          الصف_المرغوب: string | null
          المؤهل_العلمي_الديني: string[] | null
          المهارات: string | null
          الوظيفة_المرغوبة: string | null
          تاريخ_الميلاد: string | null
          حالة_الطلب: string | null
          رقم_الهاتف: string | null
          سنوات_الالتزام: number | null
          عدد_سنوات_التحصيل: number | null
          مكان_وصول_الحفظ: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          اسم_الاب?: string | null
          اسم_الاستاذ: string
          اسم_الثانوية_الشرعية?: string | null
          اسم_السجن_السابق?: string | null
          اسم_المعلم_السابق?: string | null
          الأحلام?: string | null
          البريد_الالكتروني?: string | null
          التحصيل_الدراسي?: string | null
          الحالة_الاجتماعية?: string | null
          الحالة_الصحية_والنفسية?: string | null
          الصف_المرغوب?: string | null
          المؤهل_العلمي_الديني?: string[] | null
          المهارات?: string | null
          الوظيفة_المرغوبة?: string | null
          تاريخ_الميلاد?: string | null
          حالة_الطلب?: string | null
          رقم_الهاتف?: string | null
          سنوات_الالتزام?: number | null
          عدد_سنوات_التحصيل?: number | null
          مكان_وصول_الحفظ?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          اسم_الاب?: string | null
          اسم_الاستاذ?: string
          اسم_الثانوية_الشرعية?: string | null
          اسم_السجن_السابق?: string | null
          اسم_المعلم_السابق?: string | null
          الأحلام?: string | null
          البريد_الالكتروني?: string | null
          التحصيل_الدراسي?: string | null
          الحالة_الاجتماعية?: string | null
          الحالة_الصحية_والنفسية?: string | null
          الصف_المرغوب?: string | null
          المؤهل_العلمي_الديني?: string[] | null
          المهارات?: string | null
          الوظيفة_المرغوبة?: string | null
          تاريخ_الميلاد?: string | null
          حالة_الطلب?: string | null
          رقم_الهاتف?: string | null
          سنوات_الالتزام?: number | null
          عدد_سنوات_التحصيل?: number | null
          مكان_وصول_الحفظ?: string | null
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
          "اسم الاب": string | null
          "اسم الاستاذ": string | null
          "اسم الثانوية الشرعية": string | null
          "اسم السجن السابق": string | null
          "اسم المعلم السابق": string | null
          الأحلام: string | null
          "البريد الالكتروني": string | null
          "التحصيل الدراسي": string | null
          "الحالة الاجتماعية": string | null
          "الحالة الصحية والنفسية": string | null
          السجن: string | null
          "الصف المرغوب": string | null
          "المؤهل العلمي الديني": string[] | null
          المهارات: string | null
          "الوظيفة المرغوبة": string | null
          "تاريخ الميلاد": string | null
          "حالة الطلب": string | null
          "رقم الهاتف": string | null
          "سنوات الالتزام": number | null
          "عدد سنوات التحصيل": number | null
          "مكان وصول الحفظ": string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
          "اسم الاب"?: string | null
          "اسم الاستاذ"?: string | null
          "اسم الثانوية الشرعية"?: string | null
          "اسم السجن السابق"?: string | null
          "اسم المعلم السابق"?: string | null
          الأحلام?: string | null
          "البريد الالكتروني"?: string | null
          "التحصيل الدراسي"?: string | null
          "الحالة الاجتماعية"?: string | null
          "الحالة الصحية والنفسية"?: string | null
          السجن?: string | null
          "الصف المرغوب"?: string | null
          "المؤهل العلمي الديني"?: string[] | null
          المهارات?: string | null
          "الوظيفة المرغوبة"?: string | null
          "تاريخ الميلاد"?: string | null
          "حالة الطلب"?: string | null
          "رقم الهاتف"?: string | null
          "سنوات الالتزام"?: number | null
          "عدد سنوات التحصيل"?: number | null
          "مكان وصول الحفظ"?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
          "اسم الاب"?: string | null
          "اسم الاستاذ"?: string | null
          "اسم الثانوية الشرعية"?: string | null
          "اسم السجن السابق"?: string | null
          "اسم المعلم السابق"?: string | null
          الأحلام?: string | null
          "البريد الالكتروني"?: string | null
          "التحصيل الدراسي"?: string | null
          "الحالة الاجتماعية"?: string | null
          "الحالة الصحية والنفسية"?: string | null
          السجن?: string | null
          "الصف المرغوب"?: string | null
          "المؤهل العلمي الديني"?: string[] | null
          المهارات?: string | null
          "الوظيفة المرغوبة"?: string | null
          "تاريخ الميلاد"?: string | null
          "حالة الطلب"?: string | null
          "رقم الهاتف"?: string | null
          "سنوات الالتزام"?: number | null
          "عدد سنوات التحصيل"?: number | null
          "مكان وصول الحفظ"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          session_date: string
          started_at: string | null
          started_by_name: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          session_date: string
          started_at?: string | null
          started_by_name?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          session_date?: string
          started_at?: string | null
          started_by_name?: string | null
          teacher_id?: string
        }
        Relationships: []
      }
      tool_loss_history: {
        Row: {
          created_at: string | null
          event_date: string
          event_time: string
          event_type: string
          handled_by: string | null
          id: string
          item_id: string
          notes: string | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          event_date?: string
          event_time?: string
          event_type: string
          handled_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          event_date?: string
          event_time?: string
          event_type?: string
          handled_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_loss_history_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_loss_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "check_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_loss_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_reissues: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          last_reissue_date: string
          loss_date: string | null
          reissue_admin_id: string | null
          reissue_count: number
          reissue_notes: string | null
          reissued_by_admin: boolean | null
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          last_reissue_date?: string
          loss_date?: string | null
          reissue_admin_id?: string | null
          reissue_count?: number
          reissue_notes?: string | null
          reissued_by_admin?: boolean | null
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          last_reissue_date?: string
          loss_date?: string | null
          reissue_admin_id?: string | null
          reissue_count?: number
          reissue_notes?: string | null
          reissued_by_admin?: boolean | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_reissues_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "check_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_reissues_reissue_admin_id_fkey"
            columns: ["reissue_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_reissues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_teacher: { Args: { p_teacher_data: Json }; Returns: string }
      admin_reset_teacher_day: {
        Args: { p_date: string; p_teacher_id: string }
        Returns: undefined
      }
      create_teacher_account: {
        Args: {
          p_email?: string
          p_password: string
          p_phone?: string
          p_teacher_id: string
          p_username: string
        }
        Returns: string
      }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      reset_teacher_day: {
        Args: { p_date: string; p_teacher_id: string }
        Returns: undefined
      }
      set_attendance: {
        Args: {
          p_date: string
          p_points?: number
          p_status: string
          p_student_id: string
        }
        Returns: undefined
      }
      update_backup_cron_schedule: {
        Args: { p_interval_days?: number; p_schedule?: string }
        Returns: undefined
      }
      update_user_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: undefined
      }
      verify_user_email: { Args: { p_email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher" | "supervisor" | "parent" | "student"
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
      app_role: ["admin", "teacher", "supervisor", "parent", "student"],
    },
  },
} as const
