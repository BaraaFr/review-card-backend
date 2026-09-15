type SubscriptionLike = {
  status:
    | "TRIAL"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "EXPIRED";

  expiresAt:
    Date | null;
};

export const isSubscriptionUsable = (
  subscription:
    SubscriptionLike | null
): boolean => {
  /*
   * No subscription means
   * no paid ValYou service.
   */
  if (
    !subscription
  ) {
    return false;
  }

  /*
   * For now only TRIAL and ACTIVE
   * subscriptions can use ValYou.
   *
   * PAST_DUE
   * CANCELED
   * EXPIRED
   *
   * are all unusable.
   */
  if (
    subscription.status !==
      "TRIAL" &&
    subscription.status !==
      "ACTIVE"
  ) {
    return false;
  }

  /*
   * A null expiresAt keeps the current
   * existing "unlimited subscription"
   * behavior.
   *
   * Otherwise the subscription becomes
   * unusable immediately when its
   * expiration time is reached.
   */
  if (
    subscription.expiresAt &&
    subscription.expiresAt.getTime() <=
      Date.now()
  ) {
    return false;
  }

  return true;
};