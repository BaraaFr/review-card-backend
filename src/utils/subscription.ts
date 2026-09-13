type SubscriptionLike = {
    status:
      | "TRIAL"
      | "ACTIVE"
      | "PAST_DUE"
      | "CANCELED"
      | "EXPIRED";
  
    expiresAt: Date | null;
  };
  
  export const isSubscriptionUsable = (
    subscription: SubscriptionLike | null
  ): boolean => {
    if (!subscription) {
      return false;
    }
  
    if (
      subscription.status !== "TRIAL" &&
      subscription.status !== "ACTIVE"
    ) {
      return false;
    }
  
    if (
      subscription.expiresAt &&
      subscription.expiresAt < new Date()
    ) {
      return false;
    }
  
    return true;
  };