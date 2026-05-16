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
          linkedin_url: string | null
          github_handle: string | null
          role_ids: string[]
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string
          role?: string
          linkedin_url?: string | null
          github_handle?: string | null
          role_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: string
          linkedin_url?: string | null
          github_handle?: string | null
          role_ids?: string[]
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
          manager_read: string[]
          manager_read_updated_at: string | null
          coaching_nudges: Array<{ text: string; theme: string }> | null
          coaching_nudges_updated_at: string | null
          is_squad_lead: boolean
          relationship: string
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
          manager_read?: string[]
          manager_read_updated_at?: string | null
          coaching_nudges?: Array<{ text: string; theme: string }> | null
          coaching_nudges_updated_at?: string | null
          is_squad_lead?: boolean
          relationship?: string
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
          manager_read?: string[]
          manager_read_updated_at?: string | null
          coaching_nudges?: Array<{ text: string; theme: string }> | null
          coaching_nudges_updated_at?: string | null
          is_squad_lead?: boolean
          relationship?: string
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
          coaching_questions: string[]
          title: string | null
          duration_minutes: number | null
          google_calendar_event_id: string | null
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
          coaching_questions?: string[]
          title?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
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
          coaching_questions?: string[]
          title?: string | null
          duration_minutes?: number | null
          google_calendar_event_id?: string | null
        }
      }
      user_oauth_tokens: {
        Row: {
          id: string
          user_id: string
          provider: string
          access_token: string
          refresh_token: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: string
          access_token: string
          refresh_token?: string | null
          expires_at?: string | null
        }
        Update: {
          access_token?: string
          refresh_token?: string | null
          expires_at?: string | null
          updated_at?: string
        }
      }
      action_items: {
        Row: {
          id: string
          interaction_id: string | null
          title: string | null
          description: string
          status: string
          due_date: string | null
          assignee_id: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          interaction_id?: string | null
          title?: string | null
          description: string
          status?: string
          due_date?: string | null
          assignee_id?: string | null
          user_id?: string | null
        }
        Update: {
          interaction_id?: string | null
          title?: string | null
          description?: string
          status?: string
          due_date?: string | null
          assignee_id?: string | null
          user_id?: string | null
        }
      }
      agenda_items: {
        Row: {
          id: string
          interaction_id: string
          text: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          interaction_id: string
          text: string
          status?: string
        }
        Update: {
          text?: string
          status?: string
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
      knowledge_documents: {
        Row: {
          id: string
          manager_id: string
          title: string
          content: string
          source: string | null
          content_vector: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          title: string
          content: string
          source?: string | null
          content_vector?: number[] | null
        }
        Update: {
          title?: string
          content?: string
          source?: string | null
          content_vector?: number[] | null
          updated_at?: string
        }
      }
      knowledge_chunks: {
        Row: {
          id: string
          document_id: string
          manager_id: string
          content: string
          content_vector: number[] | null
          chunk_index: number
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          manager_id: string
          content: string
          content_vector?: number[] | null
          chunk_index?: number
        }
        Update: {
          content?: string
          content_vector?: number[] | null
        }
      }
      chat_conversations: {
        Row: {
          id: string
          manager_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          title?: string | null
        }
        Update: {
          title?: string | null
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string | null
          tool_calls: Json | null
          tool_results: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content?: string | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
      }
      personal_items: {
        Row: {
          id: string
          user_id: string
          type: 'note' | 'todo' | 'link' | 'reminder'
          content: string
          url: string | null
          status: 'open' | 'done'
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'note' | 'todo' | 'link' | 'reminder'
          content?: string
          url?: string | null
          status?: 'open' | 'done'
          due_date?: string | null
        }
        Update: {
          type?: 'note' | 'todo' | 'link' | 'reminder'
          content?: string
          url?: string | null
          status?: 'open' | 'done'
          due_date?: string | null
        }
      }
      github_activity_snapshots: {
        Row: {
          id: string
          manager_id: string
          github_handle: string
          week_start: string
          pr_review_comment_count: number
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          github_handle: string
          week_start: string
          pr_review_comment_count?: number
        }
        Update: {
          pr_review_comment_count?: number
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
export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type KnowledgeDocument = Database['public']['Tables']['knowledge_documents']['Row']
export type KnowledgeChunk = Database['public']['Tables']['knowledge_chunks']['Row']
export type AgendaItem = Database['public']['Tables']['agenda_items']['Row']
export type PersonalItem = Database['public']['Tables']['personal_items']['Row']
export type UserOAuthToken = Database['public']['Tables']['user_oauth_tokens']['Row']

export type WorkshopPersonaAnalysis = {
  persona_id: string
  reasoning: string
  framing: string
  key_insights: string[]
  blind_spots: string
  recommended_actions: { action: string; priority: 'high' | 'medium' | 'low'; timeframe: string; why: string }[]
  questions_to_explore: string[]
}

export type WorkshopSynthesis = {
  summary: string
  convergence_points: string[]
  divergence_points: { topic: string; perspectives: string }[]
  unified_actions: {
    action: string
    rationale: string
    priority: 'high' | 'medium' | 'low'
    source_personas: string[]
  }[]
}

export type WorkshopSession = {
  id: string
  user_id: string
  question: string
  persona_ids: string[]
  persona_analyses: WorkshopPersonaAnalysis[]
  synthesis: WorkshopSynthesis
  created_at: string
}

export type StrategicInitiative = {
  id: string
  manager_id: string
  title: string
  description: Json | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  tags: string[]
  domain: string | null
  horizon: string | null
  source_chat_id: string | null
  parent_id: string | null
  depth: number
  created_at: string
  updated_at: string
}
