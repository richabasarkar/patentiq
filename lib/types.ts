export interface Examiner {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
  avg_office_actions?: number;
  avg_office_actions_actual?: number;
  pendency_months?: number;
  total_applications?: number;
  top_rejection_codes?: Record<string, number>;
  rejection_codes?: {
    non_final: number;
    final: number;
    total: number;
  };
  interview_count?: number;
  interview_allowance_rate?: number;
  grant_rate_by_year?: Record<string, number>;
  ai_summary?: string;
  updated_at?: string;
}