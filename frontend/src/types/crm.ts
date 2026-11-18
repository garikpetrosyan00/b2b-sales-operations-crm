import type { User } from "./auth";

export type CompanySize = "startup" | "small" | "medium" | "enterprise";
export type LeadSource = "website" | "referral" | "outbound" | "event" | "partner" | "other";
export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted";
export type LeadPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  company_size: CompanySize | null;
  country: string | null;
  notes: string | null;
}

export interface Contact {
  id: string;
  company_id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  work_email: string;
  phone: string | null;
  job_title: string | null;
}

export interface Lead {
  id: string;
  company_id: string;
  primary_contact_id: string;
  owner_id: string;
  source: LeadSource;
  status: LeadStatus;
  estimated_value: string;
  priority: LeadPriority;
  next_follow_up_at: string | null;
  notes: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  display_order: number;
  color: string;
  probability: number;
  sla_hours: number;
  is_active: boolean;
  is_terminal: boolean;
  is_won: boolean;
}

export interface Deal {
  id: string;
  title: string;
  company_id: string;
  primary_contact_id: string;
  owner_id: string;
  stage_id: string;
  source_lead_id: string | null;
  value: string;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  last_activity_at: string | null;
  loss_reason: string | null;
  notes: string | null;
  company_name: string;
  contact_name: string;
  owner_name: string;
  stage_name: string;
  stage_color: string;
  stage_entered_at: string;
  sla_breached: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineColumn {
  stage: PipelineStage;
  deals: Deal[];
  total_value: string;
}

export interface PipelineBoard {
  columns: PipelineColumn[];
  currency: string;
}

export interface DashboardSummary {
  active_pipeline_value: string;
  weighted_pipeline_value: string;
  open_deal_count: number;
  overdue_follow_up_count: number;
  deals_requiring_attention: number;
  closing_this_month: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  actor_id: string;
  actor_name: string;
  activity_type: ActivityType;
  summary: string;
  details: string | null;
  occurred_at: string;
}

export interface StageHistory {
  id: string;
  previous_stage_name: string | null;
  new_stage_name: string;
  changed_by_name: string;
  changed_at: string;
  time_spent_seconds: number | null;
}

export interface DealTimeline {
  activities: DealActivity[];
  stage_history: StageHistory[];
}

export interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string;
  completed_at: string | null;
  assignee_id: string;
  assignee_name: string;
  related_lead_id: string | null;
  related_deal_id: string | null;
  related_record_name: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskPage {
  items: CrmTask[];
  total: number;
  todo_count: number;
  overdue_count: number;
  completed_count: number;
}

export interface PipelineReportStage {
  stage_name: string;
  color: string;
  deal_count: number;
  total_value: string;
  weighted_value: string;
}

export interface OwnerPerformance {
  owner_id: string;
  owner_name: string;
  active_deals: number;
  active_value: string;
  won_deals: number;
  won_value: string;
}

export interface LeadSourceReport {
  source: LeadSource;
  lead_count: number;
  converted_count: number;
}

export interface ReportsSummary {
  total_pipeline: string;
  weighted_pipeline: string;
  won_revenue: string;
  win_rate: number;
  average_deal_size: string;
  overdue_tasks: number;
  by_stage: PipelineReportStage[];
  by_owner: OwnerPerformance[];
  by_source: LeadSourceReport[];
}

export type Owner = User;
