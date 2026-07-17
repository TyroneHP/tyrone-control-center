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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_subject_id: string | null
          created_at: string
          id: string
          metadata: Json
          object_id: string | null
          object_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_subject_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_id?: string | null
          object_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_subject_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_id?: string | null
          object_type?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          auth_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database['public']['Enums']['app_role']
          status: Database['public']['Enums']['invitation_status']
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['invitation_status']
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['invitation_status']
          updated_at?: string
        }
        Relationships: []
      }
      function_rate_limits: {
        Row: {
          bucket_started_at: string
          key_hash: string
          request_count: number
          updated_at: string
        }
        Insert: {
          bucket_started_at?: string
          key_hash: string
          request_count?: number
          updated_at?: string
        }
        Update: {
          bucket_started_at?: string
          key_hash?: string
          request_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          cleanup_claimed_at: string | null
          deactivated_at: string | null
          deletion_scheduled_at: string | null
          display_name: string | null
          email: string
          id: string
          invitation_id: string | null
          role: Database['public']['Enums']['app_role']
          status: Database['public']['Enums']['profile_status']
          updated_at: string
        }
        Insert: {
          created_at?: string
          cleanup_claimed_at?: string | null
          deactivated_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email: string
          id: string
          invitation_id?: string | null
          role: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['profile_status']
          updated_at?: string
        }
        Update: {
          created_at?: string
          cleanup_claimed_at?: string | null
          deactivated_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          invitation_id?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: Database['public']['Enums']['profile_status']
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      accept_current_invitation: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      current_user_is_active: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      claim_cleanup_candidate: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['app_role'] | null
      }
      consume_function_rate_limit: {
        Args: {
          p_key_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      deactivate_profile: {
        Args: { p_actor_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      list_cleanup_candidates: {
        Args: Record<PropertyKey, never>
        Returns: {
          deletion_scheduled_at: string
          email: string
          user_id: string
        }[]
      }
      reserve_invitation: {
        Args: {
          p_email: string
          p_expires_at?: string
          p_invited_by?: string
          p_role?: Database['public']['Enums']['app_role']
        }
        Returns: string
      }
      release_cleanup_claim: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      revoke_user_refresh_sessions: {
        Args: { p_user_id: string }
        Returns: number
      }
      restore_profile: {
        Args: { p_actor_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: 'admin' | 'member'
      invitation_status: 'pending' | 'accepted' | 'revoked' | 'expired'
      profile_status: 'invited' | 'active' | 'deactivated'
    }
    CompositeTypes: Record<string, never>
  }
}
