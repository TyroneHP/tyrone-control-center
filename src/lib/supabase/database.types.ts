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
          created_at: string
          id: string
          metadata: Json
          object_id: string | null
          object_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_id?: string | null
          object_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
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
      profiles: {
        Row: {
          created_at: string
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
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['app_role'] | null
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
