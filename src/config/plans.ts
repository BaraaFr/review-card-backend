export const PLAN_LIMITS = {
    STARTER: {
      stores: 1,
      cards: 2,
    },
  
    PRO: {
      stores: 3,
      cards: 10,
    },
  
    BUSINESS: {
      stores: 10,
      cards: 50,
    },
  } as const;
  
  export type PlanName =
    keyof typeof PLAN_LIMITS;