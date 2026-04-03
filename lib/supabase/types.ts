export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          manager_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          manager_id?: string | null
        }
        Update: {
          name?: string
          parent_id?: string | null
          manager_id?: string | null
        }
      }
      team_members: {
        Row: {
          id: string
          manager_id: string
          team_id: string | null
          name: string
          email: string | null
          level: string | null
          role_description: string | null
          role_id: string | null
          start_date: string | null
          skills: string[]
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          team_id?: string | null
          name: string
          email?: string | null
          level?: string | null
          role_description?: string | null
          role_id?: string | null
          start_date?: string | null
          skills?: string[]
        }
        Update: {
          team_id?: string | null
          name?: string
          email?: string | null
          level?: string | null
          role_description?: string | null
          role_id?: string | null
          start_date?: string | null
          skills?: string[]
        }
      }
      roles: {
        Row: {
          id: string
          manager_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          title: string
        }
        Update: {
          title?: string
          updated_at?: string
        }
      }
      role_areas: {
        Row: {
          id: string
          role_id: string
          title: string
          description: Json | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          role_id: string
          title?: string
          description?: Json | null
          display_order?: number
        }
        Update: {
          title?: string
          description?: Json | null
          display_order?: number
          updated_at?: string
        }
      }
      interactions: {
        Row: {
          id: string
          participant_id: string
          manager_id: string
          scheduled_at: string
          type: string
          status: string
          agenda: string | null
          raw_json_notes: Json | null
          ai_summary: string | null
          sentiment_score: number | null
          key_themes: string[]
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          manager_id: string
          scheduled_at?: string
          type?: string
          status?: string
          agenda?: string | null
          raw_json_notes?: Json | null
          ai_summary?: string | null
          sentiment_score?: number | null
          key_themes?: string[]
          title?: string | null
        }
        Update: {
          scheduled_at?: string
          type?: string
          status?: string
          agenda?: string | null
          raw_json_notes?: Json | null
          ai_summary?: string | null
          sentiment_score?: number | null
          key_themes?: string[]
          title?: string | null
        }
      }
      action_items: {
        Row: {
          id: string
          interaction_id: string
          description: string
          status: string
          due_date: string | null
          assignee_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          interaction_id: string
          description: string
          status?: string
          due_date?: string | null
          assignee_id?: string | null
        }
        Update: {
          description?: string
          status?: string
          due_date?: string | null
          assignee_id?: string | null
        }
      }
      team_values: {
        Row: {
          id: string
          team_id: string
          manager_id: string
          name: string
          description: string | null
          keywords: string[]
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          manager_id: string
          name: string
          description?: string | null
          keywords?: string[]
        }
        Update: {
          name?: string
          description?: string | null
          keywords?: string[]
        }
      }
      team_member_integrations: {
        Row: {
          id: string
          member_id: string
          manager_id: string
          provider: string
          handle: string
          config: Record<string, string>
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          manager_id: string
          provider: string
          handle: string
          config?: Record<string, string>
        }
        Update: {
          handle?: string
          config?: Record<string, string>
        }
      }
      goal_templates: {
        Row: {
          id: string
          manager_id: string
          title: string
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          title: string
        }
        Update: {
          title?: string
        }
      }
      member_goals: {
        Row: {
          id: string
          member_id: string
          manager_id: string
          period_type: string
          year: number
          period: number | null
          title: string
          description: Json | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          member_id: string
          manager_id: string
          period_type?: string
          year: number
          period?: number | null
          title: string
          description?: Json | null
          status?: string
        }
        Update: {
          title?: string
          description?: Json | null
          status?: string
          period_type?: string
          year?: number
          period?: number | null
          updated_at?: string
        }
      }
      embeddings: {
        Row: {
          id: string
          interaction_id: string
          content: string
          content_vector: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          interaction_id: string
          content: string
          content_vector?: number[] | null
        }
        Update: {
          content?: string
          content_vector?: number[] | null
        }
      }
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          interaction_id: string
          content: string
          similarity: number
          participant_name: string
          scheduled_at: string
        }[]
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type Interaction = Database['public']['Tables']['interactions']['Row']
export type ActionItem = Database['public']['Tables']['action_items']['Row']
export type Embedding = Database['public']['Tables']['embeddings']['Row']
export type TeamValue = Database['public']['Tables']['team_values']['Row']
export type MemberIntegration = Database['public']['Tables']['team_member_integrations']['Row']
export type GoalTemplate = Database['public']['Tables']['goal_templates']['Row']
export type MemberGoal = Database['public']['Tables']['member_goals']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type RoleArea = Database['public']['Tables']['role_areas']['Row']
