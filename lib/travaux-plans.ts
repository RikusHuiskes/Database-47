export const travauxPlans = {
  monthly: { amount: '25.00', cents: 2500, months: 1 },
  annual: { amount: '250.00', cents: 25000, months: 12 },
} as const;
export type TravauxPlan = keyof typeof travauxPlans;

export function isTravauxPlan(value: unknown): value is TravauxPlan {
  return typeof value === 'string' && Object.hasOwn(travauxPlans, value);
}
