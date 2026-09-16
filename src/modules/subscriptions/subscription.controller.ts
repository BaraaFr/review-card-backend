import type {
  Request,
  Response,
} from "express";

import {
  activatePaidSubscriptionSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from "./subscription.schema.js";

import {
  subscriptionService,
} from "./subscription.service.js";

export const getCurrentSubscription =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const subscription =
        await subscriptionService.getCurrent(
          req.user,
          req.params.businessId as string
        );

      return res.status(200).json({
        success: true,

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
        "BUSINESS_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Business not found",
        });
      }

      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to load subscription",
      });
    }
  };

export const getSubscriptionUsage =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const result =
        await subscriptionService.getUsage(
          req.user,
          req.params.businessId as string
        );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
        "BUSINESS_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Business not found",
        });
      }

      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to load subscription usage",
      });
    }
  };

export const createSubscription =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const validation =
        createSubscriptionSchema.safeParse(
          req.body
        );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message:
            "Validation failed",

          errors:
            validation.error
              .flatten()
              .fieldErrors,
        });
      }

      const subscription =
        await subscriptionService.create(
          req.params.businessId as string,
          validation.data
        );

      return res.status(201).json({
        success: true,

        message:
          "Subscription created successfully",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
        "BUSINESS_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Business not found",
        });
      }

      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to create subscription",
      });
    }
  };

export const updateSubscription =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const validation =
        updateSubscriptionSchema.safeParse(
          req.body
        );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message:
            "Validation failed",

          errors:
            validation.error
              .flatten()
              .fieldErrors,
        });
      }

      const subscription =
        await subscriptionService.update(
          req.params.id as string,
          validation.data
        );

      return res.status(200).json({
        success: true,

        message:
          "Subscription updated successfully",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
        "SUBSCRIPTION_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Subscription not found",
        });
      }

      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to update subscription",
      });
    }
  };

export const startBusinessTrial =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const businessId =
        req.params
          .businessId as string;

      const subscription =
        await subscriptionService
          .startTrial(
            businessId
          );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "30-day free trial started successfully",

          data: {
            subscription,
          },
        });
    } catch (error) {
      if (
        error instanceof Error
      ) {
        switch (
        error.message
        ) {
          case "BUSINESS_NOT_FOUND":
            return res
              .status(404)
              .json({
                success: false,

                message:
                  "Business not found",
              });

          case "TRIAL_ALREADY_USED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "This business has already used its free trial",
              });

          case "DELIVERED_CARD_REQUIRED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "At least one paid and delivered card is required before starting the trial",
              });

          case "SUBSCRIPTION_ALREADY_ACTIVE":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "This business already has an active subscription",
              });

          case "TRIAL_STORE_LIMIT_REACHED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "The business exceeds the Starter trial location limit",
              });

          case "TRIAL_CARD_LIMIT_REACHED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "The business exceeds the Starter trial card limit",
              });
        }
      }

      console.error(
        "startBusinessTrial error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to start free trial",
        });
    }
  };

  export const activatePaidSubscription =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const validation =
        activatePaidSubscriptionSchema
          .safeParse(
            req.body
          );

      if (
        !validation.success
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Validation failed",

            errors:
              validation.error
                .flatten(),
          });
      }

      const subscription =
        await subscriptionService
          .activatePaidPlan(
            req.params
              .businessId as string,

            validation.data
          );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Subscription activated successfully",

          data: {
            subscription,
          },
        });
    } catch (error) {
      if (
        error instanceof Error
      ) {
        switch (
          error.message
        ) {
          case "BUSINESS_NOT_FOUND":
            return res
              .status(404)
              .json({
                success: false,

                message:
                  "Business not found",
              });

          case "PLAN_STORE_LIMIT_EXCEEDED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "This business has more locations than the selected plan allows",
              });

          case "PLAN_CARD_LIMIT_EXCEEDED":
            return res
              .status(409)
              .json({
                success: false,

                message:
                  "This business has more cards than the selected plan allows",
              });
        }
      }

      console.error(
        "activatePaidSubscription error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to activate subscription",
        });
    }
  };