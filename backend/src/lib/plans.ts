export const FREE_GROUP_LIMIT = 1;
export const FREE_MEMBER_LIMIT = 4;

export function isPremiumPlan(plan: string): boolean {
  return plan === "premium";
}
