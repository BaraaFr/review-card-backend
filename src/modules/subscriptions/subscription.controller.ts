import type {
  Request,
  Response,
} from "express";

import {
  subscriptionService,
} from "./subscription.service.js";

export const getCurrentSubscription =
  async (
    req:
      Request,

    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required",
          });
      }

      const subscription =
        await subscriptionService
          .getCurrent(
            req.user,

            req.params
              .businessId as string
          );

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            subscription,
          },
        });
    } catch (
      error
    ) {
      if (
        error instanceof
          Error &&
        error.message ===
          "BUSINESS_NOT_FOUND"
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Business not found",
          });
      }

      console.error(
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load subscription",
        });
    }
  };

export const getSubscriptionUsage =
  async (
    req:
      Request,

    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required",
          });
      }

      const result =
        await subscriptionService
          .getUsage(
            req.user,

            req.params
              .businessId as string
          );

      return res
        .status(200)
        .json({
          success:
            true,

          data:
            result,
        });
    } catch (
      error
    ) {
      if (
        error instanceof
          Error &&
        error.message ===
          "BUSINESS_NOT_FOUND"
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Business not found",
          });
      }

      console.error(
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load subscription usage",
        });
    }
  };