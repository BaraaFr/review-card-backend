import {
    PLAN_LIMITS,
  } from "../config/plans.js";
  
  import {
    subscriptionService,
  } from "../modules/subscriptions/subscription.service.js";
  
  type UserRole =
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
  
  interface ProvisioningLimits {
    stores: number;
    cards: number;
  }
  
  interface ResolveProvisioningAccessInput {
    businessId: string;
    role: UserRole;
  }
  
  interface ResolveProvisioningAccessResult {
    subscription:
      | Awaited<
          ReturnType<
            typeof subscriptionService.getCurrentForBusiness
          >
        >
      | null;
  
    limits: ProvisioningLimits;
  
    usingStarterProvisioningLimits: boolean;
  }
  
  /**
   * Determines which limits may be used while provisioning
   * a ValYou business.
   *
   * Rules:
   *
   * BUSINESS_OWNER:
   * - Must have a usable subscription.
   * - Uses their current plan limits.
   *
   * SUPER_ADMIN:
   * - If business has a usable subscription, use that plan.
   * - If business does not yet have a usable subscription,
   *   allow setup using STARTER limits.
   */
  export async function resolveProvisioningAccess({
    businessId,
    role,
  }: ResolveProvisioningAccessInput): Promise<ResolveProvisioningAccessResult> {
    const subscription =
      await subscriptionService
        .getCurrentForBusiness(
          businessId
        );
  
    /*
     * Normal subscribed customer.
     */
    if (
      subscription?.usable
    ) {
      return {
        subscription,
  
        limits: {
          stores:
            subscription
              .limits.stores,
  
          cards:
            subscription
              .limits.cards,
        },
  
        usingStarterProvisioningLimits:
          false,
      };
    }
  
    /*
     * SuperAdmin is preparing a new customer
     * before the trial starts.
     */
    if (
      role ===
      "SUPER_ADMIN"
    ) {
      return {
        subscription:
          subscription ?? null,
  
        limits: {
          stores:
            PLAN_LIMITS
              .STARTER.stores,
  
          cards:
            PLAN_LIMITS
              .STARTER.cards,
        },
  
        usingStarterProvisioningLimits:
          true,
      };
    }
  
    /*
     * Business owners cannot bypass subscription.
     */
    throw new Error(
      "SUBSCRIPTION_REQUIRED"
    );
  }