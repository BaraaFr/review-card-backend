import {
    recordInteraction,
  } from "./interaction-tracking.service.js";
  
  /*
   * =========================================================
   * Process-local public tracking ceiling
   * =========================================================
   *
   * Each API process may have at most
   * eight tracking operations in flight.
   *
   * This is deliberately higher than the
   * tracking Prisma connection pool because
   * some operations may briefly be waiting
   * for connections.
   */
  const MAX_PENDING =
    8;
  
  /*
   * Customer-facing redirect budget.
   *
   * Analytics may continue after this timeout,
   * but the customer should not keep waiting.
   */
  const REDIRECT_TRACKING_BUDGET_MS =
    250;
  
  const pending =
    new Set<
      Promise<void>
    >();
  
  export async function trackWithinBudget(
    input:
      Parameters<
        typeof recordInteraction
      >[0]
  ) {
    /*
     * Drop analytics before putting
     * unlimited pressure on the process.
     *
     * The physical redirect remains available.
     */
    if (
      pending.size >=
      MAX_PENDING
    ) {
      console.warn(
        "interaction_dropped",
        {
          reason:
            "tracking_capacity",
        }
      );
  
      return;
    }
  
    const work =
      recordInteraction(
        input
      )
        .then(
          () => {}
        )
        .catch(
          () => {
            /*
             * Do not expose database details
             * and don't turn analytics failure
             * into redirect failure.
             */
            console.warn(
              "interaction_dropped",
              {
                reason:
                  "tracking_failed",
              }
            );
          }
        )
        .finally(
          () => {
            pending.delete(
              work
            );
          }
        );
  
    pending.add(
      work
    );
  
    let timer:
      NodeJS.Timeout |
      undefined;
  
    /*
     * Give analytics only 250ms of the
     * customer's redirect path.
     *
     * If it isn't done by then:
     *
     * redirect proceeds
     * tracking continues independently
     */
    await Promise.race([
      work,
  
      new Promise<void>(
        (
          resolve
        ) => {
          timer =
            setTimeout(
              resolve,
              REDIRECT_TRACKING_BUDGET_MS
            );
        }
      ),
    ]);
  
    if (
      timer
    ) {
      clearTimeout(
        timer
      );
    }
  }
  
  /*
   * =========================================================
   * Graceful shutdown
   * =========================================================
   *
   * Existing tracking work gets a chance
   * to complete before Prisma disconnects.
   */
  export async function drainTracking() {
    await Promise.allSettled(
      [
        ...pending,
      ]
    );
  }