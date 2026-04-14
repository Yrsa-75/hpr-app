export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          organization_id: string | null;
          role: 'admin' | 'manager' | 'member' | 'client_viewer';
          full_name: string | null;
          email: string;
          avatar_url: string | null;
          preferences: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          role?: 'admin' | 'manager' | 'member' | 'client_viewer';
          full_name?: string | null;
          email: string;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          role?: 'admin' | 'manager' | 'member' | 'client_viewer';
          full_name?: string | null;
          email?: string;
          avatar_url?: string | null;
          preferences?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string | null;
          industry: string | null;
          logo_url: string | null;
          description: string | null;
          website: string | null;
          sender_name: string | null;
          sender_email: string | null;
          email_signature_html: string | null;
          signature_logo_url: string | null;
          signature_text: string | null;
          social_links: Json;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug?: string | null;
          industry?: string | null;
          logo_url?: string | null;
          description?: string | null;
          website?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          email_signature_html?: string | null;
          signature_logo_url?: string | null;
          signature_text?: string | null;
          social_links?: Json;
          settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          slug?: string | null;
          industry?: string | null;
          logo_url?: string | null;
          description?: string | null;
          website?: string | null;
          sender_name?: string | null;
          sender_email?: string | null;
          email_signature_html?: string | null;
          signature_logo_url?: string | null;
          signature_text?: string | null;
          social_links?: Json;
          settings?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      journalists: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          phone_direct: string | null;
          media_outlet: string | null;
          media_type: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'influenceur' | null;
          beat: string[] | null;
          location: string | null;
          linkedin_url: string | null;
          twitter_handle: string | null;
          notes: string | null;
          tags: string[] | null;
          response_rate: number | null;
          publication_rate: number | null;
          avg_response_time_hours: number | null;
          quality_score: number | null;
          last_contacted_at: string | null;
          last_responded_at: string | null;
          enrichment_data: Json | null;
          enrichment_last_run: string | null;
          is_verified: boolean;
          is_opted_out: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          phone_direct?: string | null;
          media_outlet?: string | null;
          media_type?: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'influenceur' | null;
          beat?: string[] | null;
          location?: string | null;
          linkedin_url?: string | null;
          twitter_handle?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          response_rate?: number | null;
          publication_rate?: number | null;
          avg_response_time_hours?: number | null;
          quality_score?: number | null;
          last_contacted_at?: string | null;
          last_responded_at?: string | null;
          enrichment_data?: Json | null;
          enrichment_last_run?: string | null;
          is_verified?: boolean;
          is_opted_out?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          phone_direct?: string | null;
          media_outlet?: string | null;
          media_type?: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'influenceur' | null;
          beat?: string[] | null;
          location?: string | null;
          linkedin_url?: string | null;
          twitter_handle?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          response_rate?: number | null;
          publication_rate?: number | null;
          avg_response_time_hours?: number | null;
          quality_score?: number | null;
          last_contacted_at?: string | null;
          last_responded_at?: string | null;
          enrichment_data?: Json | null;
          enrichment_last_run?: string | null;
          is_verified?: boolean;
          is_opted_out?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journalists_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          name: string;
          description: string | null;
          status: 'draft' | 'preparing' | 'review' | 'approved' | 'sending' | 'active' | 'paused' | 'completed' | 'archived';
          tags: string[] | null;
          keywords: string[] | null;
          target_date: string | null;
          embargo_until: string | null;
          total_sent: number;
          total_opened: number;
          total_clicked: number;
          total_replied: number;
          total_bounced: number;
          total_publications: number;
          estimated_reach: number;
          ai_performance_analysis: Json | null;
          ai_recommendations: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          name: string;
          description?: string | null;
          status?: 'draft' | 'preparing' | 'review' | 'approved' | 'sending' | 'active' | 'paused' | 'completed' | 'archived';
          tags?: string[] | null;
          keywords?: string[] | null;
          target_date?: string | null;
          embargo_until?: string | null;
          total_sent?: number;
          total_opened?: number;
          total_clicked?: number;
          total_replied?: number;
          total_bounced?: number;
          total_publications?: number;
          estimated_reach?: number;
          ai_performance_analysis?: Json | null;
          ai_recommendations?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          name?: string;
          description?: string | null;
          status?: 'draft' | 'preparing' | 'review' | 'approved' | 'sending' | 'active' | 'paused' | 'completed' | 'archived';
          tags?: string[] | null;
          keywords?: string[] | null;
          target_date?: string | null;
          embargo_until?: string | null;
          total_sent?: number;
          total_opened?: number;
          total_clicked?: number;
          total_replied?: number;
          total_bounced?: number;
          total_publications?: number;
          estimated_reach?: number;
          ai_performance_analysis?: Json | null;
          ai_recommendations?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      press_releases: {
        Row: {
          id: string;
          campaign_id: string;
          version: number;
          title: string;
          subtitle: string | null;
          body_html: string | null;
          body_plain: string | null;
          email_subject: string | null;
          email_preview_text: string | null;
          ai_quality_score: number | null;
          ai_quality_analysis: Json | null;
          ai_suggestions: Json | null;
          is_current: boolean;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          version?: number;
          title: string;
          subtitle?: string | null;
          body_html?: string | null;
          body_plain?: string | null;
          email_subject?: string | null;
          email_preview_text?: string | null;
          ai_quality_score?: number | null;
          ai_quality_analysis?: Json | null;
          ai_suggestions?: Json | null;
          is_current?: boolean;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          version?: number;
          title?: string;
          subtitle?: string | null;
          body_html?: string | null;
          body_plain?: string | null;
          email_subject?: string | null;
          email_preview_text?: string | null;
          ai_quality_score?: number | null;
          ai_quality_analysis?: Json | null;
          ai_suggestions?: Json | null;
          is_current?: boolean;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'press_releases_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      press_clippings: {
        Row: {
          id: string;
          campaign_id: string | null;
          client_id: string;
          journalist_id: string | null;
          title: string;
          url: string;
          source_name: string;
          source_type: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'social_media';
          published_at: string | null;
          excerpt: string | null;
          screenshot_url: string | null;
          estimated_reach: number | null;
          estimated_ave: number | null;
          sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
          detection_method: 'manual' | 'google_news' | 'monitoring' | 'journalist_shared';
          is_verified: boolean;
          ai_summary: string | null;
          ai_key_messages_found: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          client_id: string;
          journalist_id?: string | null;
          title: string;
          url: string;
          source_name: string;
          source_type: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'social_media';
          published_at?: string | null;
          excerpt?: string | null;
          screenshot_url?: string | null;
          estimated_reach?: number | null;
          estimated_ave?: number | null;
          sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
          detection_method?: 'manual' | 'google_news' | 'monitoring' | 'journalist_shared';
          is_verified?: boolean;
          ai_summary?: string | null;
          ai_key_messages_found?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          client_id?: string;
          journalist_id?: string | null;
          title?: string;
          url?: string;
          source_name?: string;
          source_type?: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'social_media';
          published_at?: string | null;
          excerpt?: string | null;
          screenshot_url?: string | null;
          estimated_reach?: number | null;
          estimated_ave?: number | null;
          sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
          detection_method?: 'manual' | 'google_news' | 'monitoring' | 'journalist_shared';
          is_verified?: boolean;
          ai_summary?: string | null;
          ai_key_messages_found?: string[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'press_clippings_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'journalist_replied' | 'article_published' | 'campaign_milestone' | 'approval_needed' | 'system_alert' | 'improvement_ready';
          title: string;
          message: string;
          data: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'journalist_replied' | 'article_published' | 'campaign_milestone' | 'approval_needed' | 'system_alert' | 'improvement_ready';
          title: string;
          message: string;
          data?: Json | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'journalist_replied' | 'article_published' | 'campaign_milestone' | 'approval_needed' | 'system_alert' | 'improvement_ready';
          title?: string;
          message?: string;
          data?: Json | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      email_sends: {
        Row: {
          id: string;
          campaign_id: string;
          press_release_id: string;
          journalist_id: string;
          resend_email_id: string | null;
          status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'unsubscribed';
          sent_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          bounced_at: string | null;
          personalized_subject: string | null;
          personalized_intro: string | null;
          ab_variant: 'A' | 'B' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          press_release_id: string;
          journalist_id: string;
          resend_email_id?: string | null;
          status?: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'unsubscribed';
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          bounced_at?: string | null;
          personalized_subject?: string | null;
          personalized_intro?: string | null;
          ab_variant?: 'A' | 'B' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          press_release_id?: string;
          journalist_id?: string;
          resend_email_id?: string | null;
          status?: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'unsubscribed';
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          bounced_at?: string | null;
          personalized_subject?: string | null;
          personalized_intro?: string | null;
          ab_variant?: 'A' | 'B' | null;
          created_at?: string;
        };
        Relationships: [];
      };
      email_threads: {
        Row: {
          id: string;
          campaign_id: string;
          journalist_id: string;
          email_send_id: string | null;
          status: 'new' | 'needs_response' | 'responded' | 'follow_up_scheduled' | 'closed' | 'positive' | 'negative';
          sentiment: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested' | null;
          ai_suggested_response: string | null;
          ai_response_strategy: string | null;
          priority_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          journalist_id: string;
          email_send_id?: string | null;
          status?: 'new' | 'needs_response' | 'responded' | 'follow_up_scheduled' | 'closed' | 'positive' | 'negative';
          sentiment?: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested' | null;
          ai_suggested_response?: string | null;
          ai_response_strategy?: string | null;
          priority_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'new' | 'needs_response' | 'responded' | 'follow_up_scheduled' | 'closed' | 'positive' | 'negative';
          sentiment?: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested' | null;
          ai_suggested_response?: string | null;
          ai_response_strategy?: string | null;
          priority_score?: number | null;
          updated_at?: string;
        };
      };
      email_messages: {
        Row: {
          id: string;
          thread_id: string;
          direction: 'inbound' | 'outbound';
          from_email: string | null;
          to_email: string | null;
          subject: string | null;
          body_html: string | null;
          body_plain: string | null;
          is_auto_reply: boolean;
          resend_inbound_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          direction: 'inbound' | 'outbound';
          from_email?: string | null;
          to_email?: string | null;
          subject?: string | null;
          body_html?: string | null;
          body_plain?: string | null;
          is_auto_reply?: boolean;
          resend_inbound_id?: string | null;
          created_at?: string;
        };
        Update: {
          body_html?: string | null;
          body_plain?: string | null;
          is_auto_reply?: boolean;
          resend_inbound_id?: string | null;
        };
      };
      client_media_assets: {
        Row: {
          id: string;
          client_id: string;
          organization_id: string;
          file_name: string;
          display_name: string;
          file_url: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          organization_id: string;
          file_name: string;
          display_name: string;
          file_url: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          organization_id?: string;
          file_name?: string;
          display_name?: string;
          file_url?: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_media_assets_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      background_tasks: {
        Row: {
          id: string;
          type: 'hunter_finder' | 'hunter_verifier' | 'google_news';
          status: 'running' | 'completed' | 'failed';
          started_at: string;
          completed_at: string | null;
          total: number | null;
          processed: number | null;
          found: number | null;
          skipped: number | null;
          failed_count: number | null;
          credits_used: number | null;
          error_message: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'hunter_finder' | 'hunter_verifier' | 'google_news';
          status?: 'running' | 'completed' | 'failed';
          started_at?: string;
          completed_at?: string | null;
          total?: number | null;
          processed?: number | null;
          found?: number | null;
          skipped?: number | null;
          failed_count?: number | null;
          credits_used?: number | null;
          error_message?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          status?: 'running' | 'completed' | 'failed';
          completed_at?: string | null;
          total?: number | null;
          processed?: number | null;
          found?: number | null;
          skipped?: number | null;
          failed_count?: number | null;
          credits_used?: number | null;
          error_message?: string | null;
          details?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, {
      Row: Record<string, unknown>;
      Relationships: never[];
    }>;
    Functions: Record<string, {
      Args: Record<string, unknown>;
      Returns: unknown;
    }>;
    Enums: {
      user_role: 'admin' | 'manager' | 'member' | 'client_viewer';
      media_type: 'presse_ecrite' | 'tv' | 'radio' | 'web' | 'podcast' | 'blog' | 'influenceur';
      campaign_status: 'draft' | 'preparing' | 'review' | 'approved' | 'sending' | 'active' | 'paused' | 'completed' | 'archived';
    };
  };
};

// Convenience type aliases
export type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];

export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export type JournalistRow = Database['public']['Tables']['journalists']['Row'];
export type JournalistInsert = Database['public']['Tables']['journalists']['Insert'];
export type JournalistUpdate = Database['public']['Tables']['journalists']['Update'];

export type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
export type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];

export type PressReleaseRow = Database['public']['Tables']['press_releases']['Row'];
export type PressReleaseInsert = Database['public']['Tables']['press_releases']['Insert'];
export type PressReleaseUpdate = Database['public']['Tables']['press_releases']['Update'];

export type PressClippingRow = Database['public']['Tables']['press_clippings']['Row'];
export type PressClippingInsert = Database['public']['Tables']['press_clippings']['Insert'];
export type PressClippingUpdate = Database['public']['Tables']['press_clippings']['Update'];

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

export type EmailSendRow = Database['public']['Tables']['email_sends']['Row'];
export type EmailSendInsert = Database['public']['Tables']['email_sends']['Insert'];
export type EmailSendUpdate = Database['public']['Tables']['email_sends']['Update'];
export type EmailSendStatus = EmailSendRow['status'];

export type EmailThreadRow = Database['public']['Tables']['email_threads']['Row'];
export type EmailThreadInsert = Database['public']['Tables']['email_threads']['Insert'];
export type EmailThreadUpdate = Database['public']['Tables']['email_threads']['Update'];
export type EmailThreadStatus = EmailThreadRow['status'];

export type EmailMessageRow = Database['public']['Tables']['email_messages']['Row'];
export type EmailMessageInsert = Database['public']['Tables']['email_messages']['Insert'];

export type ClientMediaAssetRow = Database['public']['Tables']['client_media_assets']['Row'];
export type ClientMediaAssetInsert = Database['public']['Tables']['client_media_assets']['Insert'];
