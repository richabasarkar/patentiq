export interface Examiner {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
  grant_rate_percentile?: number;
  pendency_percentile?: number;
  interview_rate_percentile?: number;
  avg_office_actions?: number;
  avg_office_actions_actual?: number;
  pendency_months?: number;
  total_applications?: number;
  rejection_codes?: {
    non_final: number;
    final: number;
    total: number; };
  allowance_after_1_oa?: number;
  allowance_after_2_oa?: number;
  abandonment_rate?: number;
  rce_rate?: number;
  avg_oas_to_allowance?: number;
  interview_count?: number;
  interview_allowance_rate?: number;
  grant_rate_by_year?: Record<string, number>;
  ai_summary?: string;
  updated_at?: string;
}

export interface ArtUnitStats {
  art_unit: string;
  tech_center: string;
  category: string;
  avg_grant_rate: number;
  avg_pendency_months: number;
  avg_interview_allowance_rate: number;
  examiner_count: number;
}
