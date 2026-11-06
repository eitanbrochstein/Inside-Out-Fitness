
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "coach_clients": {
                  Row: {
                    "client_id": string,"coach_id": string,"created_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"coach_id": string,"created_at"?: string,"status"?: string
                  }
                  Update: {
                    "client_id"?: string,"coach_id"?: string,"created_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_clients_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_clients_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coach_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"coach_id": string,"code": string,"created_at": string,"expires_at": string,"label": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"coach_id"?: string,"code"?: string,"created_at"?: string,"expires_at"?: string,"label"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"coach_id"?: string,"code"?: string,"created_at"?: string,"expires_at"?: string,"label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_invites_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_invites_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "archived_at": string | null,"category": string,"created_at": string,"equipment": string,"id": string,"load_basis": string,"name": string,"owner_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category"?: string,"created_at"?: string,"equipment"?: string,"id"?: string,"load_basis"?: string,"name": string,"owner_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: string,"created_at"?: string,"equipment"?: string,"id"?: string,"load_basis"?: string,"name"?: string,"owner_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "accent": string,"created_at": string,"display_name": string | null,"glass": boolean,"id": string,"is_coach": boolean,"rounding_increment": number,"rounding_mode": string,"theme": string,"unit": string,"updated_at": string,"weekly_goal": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accent"?: string,"created_at"?: string,"display_name"?: string | null,"glass"?: boolean,"id": string,"is_coach"?: boolean,"rounding_increment"?: number,"rounding_mode"?: string,"theme"?: string,"unit"?: string,"updated_at"?: string,"weekly_goal"?: number
                  }
                  Update: {
                    "accent"?: string,"created_at"?: string,"display_name"?: string | null,"glass"?: boolean,"id"?: string,"is_coach"?: boolean,"rounding_increment"?: number,"rounding_mode"?: string,"theme"?: string,"unit"?: string,"updated_at"?: string,"weekly_goal"?: number
                  }
                  Relationships: [
                    
                  ]
                },"program_runs": {
                  Row: {
                    "assigned_by": string | null,"created_at": string,"ended_at": string | null,"id": string,"owner_id": string,"program_id": string | null,"start_date": string,"title": string,"week_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"owner_id": string,"program_id"?: string | null,"start_date": string,"title": string,"week_count": number
                  }
                  Update: {
                    "assigned_by"?: string | null,"created_at"?: string,"ended_at"?: string | null,"id"?: string,"owner_id"?: string,"program_id"?: string | null,"start_date"?: string,"title"?: string,"week_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_runs_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_runs_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"owner_id": string,"title": string,"updated_at": string,"week_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"owner_id"?: string,"title"?: string,"updated_at"?: string,"week_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"owner_id"?: string,"title"?: string,"updated_at"?: string,"week_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"training_maxes": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"kind": string,"note": string | null,"owner_id": string,"recorded_on": string,"value_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"kind"?: string,"note"?: string | null,"owner_id"?: string,"recorded_on"?: string,"value_kg": number
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"kind"?: string,"note"?: string | null,"owner_id"?: string,"recorded_on"?: string,"value_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_maxes_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_blocks": {
                  Row: {
                    "body": string,"created_at": string,"exercise_id": string | null,"id": string,"max_kind": string,"notes": string,"owner_id": string,"position": number,"settings": NonNullable<Json>,"title": string,"type": string,"updated_at": string,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"exercise_id"?: string | null,"id"?: string,"max_kind"?: string,"notes"?: string,"owner_id": string,"position"?: number,"settings"?: NonNullable<Json>,"title"?: string,"type": string,"updated_at"?: string,"workout_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"exercise_id"?: string | null,"id"?: string,"max_kind"?: string,"notes"?: string,"owner_id"?: string,"position"?: number,"settings"?: NonNullable<Json>,"title"?: string,"type"?: string,"updated_at"?: string,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_blocks_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_blocks_workout_id_fkey"
      columns: ["workout_id"]
isOneToOne: false
      referencedRelation: "set_log"
      referencedColumns: ["workout_id"]
    },{
      foreignKeyName: "workout_blocks_workout_id_fkey"
      columns: ["workout_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"owner_id": string,"workout_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"id"?: string,"owner_id": string,"workout_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"workout_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_comments_workout_id_fkey"
      columns: ["workout_id"]
isOneToOne: false
      referencedRelation: "set_log"
      referencedColumns: ["workout_id"]
    },{
      foreignKeyName: "workout_comments_workout_id_fkey"
      columns: ["workout_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sets": {
                  Row: {
                    "actual_reps": number | null,"actual_weight_kg": number | null,"basis_max_kg": number | null,"block_id": string,"completed_at": string | null,"created_at": string,"id": string,"owner_id": string,"position": number,"prescribed_load_kg": number | null,"target_percent": number | null,"target_reps": number | null,"target_weight_kg": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_reps"?: number | null,"actual_weight_kg"?: number | null,"basis_max_kg"?: number | null,"block_id": string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"owner_id": string,"position"?: number,"prescribed_load_kg"?: number | null,"target_percent"?: number | null,"target_reps"?: number | null,"target_weight_kg"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "actual_reps"?: number | null,"actual_weight_kg"?: number | null,"basis_max_kg"?: number | null,"block_id"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"owner_id"?: string,"position"?: number,"prescribed_load_kg"?: number | null,"target_percent"?: number | null,"target_reps"?: number | null,"target_weight_kg"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sets_block_id_fkey"
      columns: ["block_id"]
isOneToOne: false
      referencedRelation: "workout_blocks"
      referencedColumns: ["id"]
    }
                  ]
                },"workouts": {
                  Row: {
                    "assigned_at": string | null,"assigned_by": string | null,"completed_at": string | null,"created_at": string,"id": string,"kind": string,"owner_id": string,"program_day": number | null,"program_id": string | null,"program_run_id": string | null,"scheduled_for": string | null,"source_workout_id": string | null,"started_at": string | null,"status": string,"subtitle": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string | null,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"program_day"?: number | null,"program_id"?: string | null,"program_run_id"?: string | null,"scheduled_for"?: string | null,"source_workout_id"?: string | null,"started_at"?: string | null,"status"?: string,"subtitle"?: string,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_at"?: string | null,"assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"program_day"?: number | null,"program_id"?: string | null,"program_run_id"?: string | null,"scheduled_for"?: string | null,"source_workout_id"?: string | null,"started_at"?: string | null,"status"?: string,"subtitle"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workouts_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workouts_program_fk"
      columns: ["program_id","owner_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "workouts_program_run_id_fkey"
      columns: ["program_run_id"]
isOneToOne: false
      referencedRelation: "program_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workouts_source_workout_id_fkey"
      columns: ["source_workout_id"]
isOneToOne: false
      referencedRelation: "set_log"
      referencedColumns: ["workout_id"]
    },{
      foreignKeyName: "workouts_source_workout_id_fkey"
      columns: ["source_workout_id"]
isOneToOne: false
      referencedRelation: "workouts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "current_maxes": {
                  Row: {
                    "exercise_id": string | null,"id": string | null,"kind": string | null,"owner_id": string | null,"recorded_on": string | null,"value_kg": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "training_maxes_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"set_log": {
                  Row: {
                    "block_position": number | null,"exercise_id": string | null,"owner_id": string | null,"performed_at": string | null,"reps": number | null,"set_id": string | null,"set_position": number | null,"weight_kg": number | null,"workout_id": string | null,"workout_title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "workout_blocks_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_code": string }; Returns: string
                           },
"add_program_workout":
{ Args: { "p_day": number,"p_new_id"?: string,"p_program": string,"p_source": string }; Returns: string
                           },
"assign_blank_workout":
{ Args: { "p_client": string,"p_new_id"?: string,"p_scheduled_for"?: string }; Returns: string
                           },
"assign_template":
{ Args: { "p_client_ids": (string)[],"p_scheduled_for"?: string,"p_template": string }; Returns: string[]
                           },
"coach_can_edit":
{ Args: { "p_workout": string }; Returns: boolean
                           },
"coach_can_edit_block":
{ Args: { "p_block": string }; Returns: boolean
                           },
"copy_workout":
{ Args: { "p_kind"?: string,"p_new_id"?: string,"p_owner"?: string,"p_scheduled_for"?: string,"p_source": string }; Returns: string
                           },
"duplicate_block":
{ Args: { "p_block": string,"p_new_id"?: string,"p_set_ids"?: (string)[] }; Returns: string
                           },
"epley_kg":
{ Args: { "p_reps": number,"p_weight": number }; Returns: number
                           },
"exercise_stats":
{ Args: { "p_exclude_workout"?: string,"p_exercise_ids": (string)[],"p_owner"?: string }; Returns: {
              "best_e1rm_kg": number,"best_performed_at": string,"best_reps": number,"best_weight_kg": number,"exercise_id": string,"last_performed_at": string,"last_reps": number,"last_weight_kg": number,"last_workout_id": string,"session_count": number
            }[]
                           },
"finish_workout":
{ Args: { "p_freezes"?: Json,"p_workout": string }; Returns: undefined
                           },
"invite_preview":
{ Args: { "p_code": string }; Returns: {
              "coach_name": string,"status": string
            }[]
                           },
"is_coach_of":
{ Args: { "p_client": string }; Returns: boolean
                           },
"my_client_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_coach_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"new_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"personal_records":
{ Args: { "p_limit"?: number,"p_owner"?: string,"p_since"?: string,"p_workout"?: string }; Returns: {
              "exercise_id": string,"kind": string,"performed_at": string,"previous": number,"reps": number,"value": number,"weight_kg": number,"workout_id": string
            }[]
                           },
"program_delete_week":
{ Args: { "p_program": string,"p_week": number }; Returns: undefined
                           },
"program_insert_week":
{ Args: { "p_at": number,"p_copy_from"?: number,"p_program": string }; Returns: undefined
                           },
"reorder_blocks":
{ Args: { "p_ids": (string)[],"p_workout": string }; Returns: undefined
                           },
"start_program":
{ Args: { "p_client_ids"?: (string)[],"p_program": string,"p_skip_before"?: string,"p_start": string }; Returns: string[]
                           },
"stop_program_run":
{ Args: { "p_run": string }; Returns: number
                           },
"training_summary":
{ Args: { "p_owner"?: string,"p_since"?: string }; Returns: {
              "categories": Json,"performed_at": string,"rep_count": number,"set_count": number,"started_at": string,"status": string,"title": string,"volume_kg": number,"workout_id": string
            }[]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
