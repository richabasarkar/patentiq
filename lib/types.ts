export interface Examiner {
  id: string;
  name: string;
  art_unit_number?: string;
  grant_rate_3yr?: number;
  avg_office_actions?: number;
  pendency_months?: number;
  total_applications?: number;
  top_rejection_codes?: Record<string, number>;
  ai_summary?: string;
  updated_at?: string;
}