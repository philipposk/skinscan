import type { RiskBand } from "@/lib/clinical";

export interface BodyPin {
  mesh: string;
  x: number;
  y: number;
  z: number;
  view: "front" | "back";
}

export interface Lesion {
  id: string;
  user_id: string;
  label: string;
  body_site: string | null;
  laterality: string | null;
  body_pin: BodyPin | null;
  status: "monitoring" | "stable" | "resolved" | "excised" | "archived";
  first_noticed_on: string | null;
  notes: string | null;
  image_count: number;
  last_image_at: string | null;
  latest_risk_band: RiskBand | null;
  next_review_due: string | null;
  created_at: string;
}

export interface LesionImage {
  id: string;
  lesion_id: string;
  storage_path: string;
  captured_at: string;
  width: number | null;
  height: number | null;
  scale_ref: string | null;
  mm_per_px: number | null;
  lesion_diameter_mm: number | null;
  quality: Record<string, unknown>;
  is_baseline: boolean;
}

export interface Assessment {
  id: string;
  image_id: string;
  lesion_id: string;
  features: Record<string, unknown>;
  model_votes: unknown[];
  risk_band: RiskBand;
  agreement: number | null;
  red_flags: string[];
  recommendation: string;
  rationale: string | null;
  model_set: string;
  created_at: string;
}

export interface Case {
  id: string;
  human_ref: string;
  user_id: string;
  status:
    | "draft"
    | "awaiting_payment"
    | "paid"
    | "assigned"
    | "in_review"
    | "answered"
    | "closed"
    | "refunded";
  patient_question: string | null;
  patient_reported_changes: string | null;
  price_cents: number;
  currency: string;
  assigned_doctor_id: string | null;
  submitted_at: string | null;
  answered_at: string | null;
  due_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  case_id: string;
  doctor_id: string;
  lesion_id: string | null;
  impression: string;
  differential: string[];
  urgency: "routine" | "soon_4_weeks" | "urgent_1_week" | "emergency";
  recommendation: string;
  refer_to: string | null;
  image_quality_sufficient: boolean;
  cannot_assess_reason: string | null;
  notes_to_patient: string | null;
  signed_at: string;
}
