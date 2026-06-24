export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type BroilerDemandPlan = {
  id: number;
  company_id: number;
  farm_id: number;
  shed_id: number;
  farm_name: string;
  shed_name: string;
  cycle_code: string | null;
  placement_date: string | null;
  processing_date: string | null;
  floor_area_m2: number;
  target_density_kg_m2: number | null;
  target_lw_kg: number | null;
  calculated_capacity_birds: number | null;
  planned_birds: number | null;
  growout_days: number | null;
  chick_allowance_pct: number | null;
  notes: string | null;
  planned_kg_m2: number | null;
  capacity_variance_birds: number | null;
  capacity_variance_pct: number | null;
  required_chicks: number | null;
  review_flag: string;
  status: string | null;
  last_saved_by: string | null;
  last_saved_at: string | null;
};

export async function fetchBroilerDemandPlans(): Promise<BroilerDemandPlan[]> {
  const res = await fetch(`${API_BASE_URL}/api/broilers/demand-plans`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load broiler demand plans");
  return res.json();
}

export async function saveBroilerDemandPlan(
  id: number,
  patch: Partial<Pick<BroilerDemandPlan, "placement_date" | "planned_birds" | "target_density_kg_m2" | "target_lw_kg" | "growout_days" | "chick_allowance_pct" | "notes" | "status">>
): Promise<BroilerDemandPlan> {
  const res = await fetch(`${API_BASE_URL}/api/broilers/demand-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, last_saved_by: "JJ" }),
  });
  if (!res.ok) throw new Error("Failed to save broiler demand plan");
  return res.json();
}
