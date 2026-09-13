import type {
  Request,
  Response,
} from "express";

import {
  createStoreSchema,
  updateStoreSchema,
} from "./store.schema.js";

import { storeService } from "./store.service.js";

export const createStore = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const validation =
      createStoreSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const store =
      await storeService.create(
        req.user,
        req.params.businessId as string,
        validation.data
      );

    return res.status(201).json({
      success: true,
      message: "Store created successfully",
      data: {
        store,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(403).json({
        success: false,
        message: error.message ===
          "SUBSCRIPTION_REQUIRED" ?
          "An active subscription is required"
          : error.message == "BUSINESS_NOT_FOUND" ?
            "Business not found"
            : error.message == "STORE_LIMIT_REACHED" ?
              "Your subscription store limit has been reached"
              : "Internal server error",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBusinessStores = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const stores =
      await storeService.findByBusiness(
        req.user,
        req.params.businessId as string
      );

    return res.status(200).json({
      success: true,
      data: {
        stores,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "BUSINESS_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getStore = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const store =
      await storeService.findById(
        req.user,
        req.params.id as string
      );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        store,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateStore = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const validation =
      updateStoreSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    const store =
      await storeService.update(
        req.user,
        req.params.id as string,
        validation.data
      );

    return res.status(200).json({
      success: true,
      message: "Store updated successfully",
      data: {
        store,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "STORE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteStore = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    await storeService.remove(
      req.user,
      req.params.id as string
    );

    return res.status(200).json({
      success: true,
      message: "Store deleted successfully",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "STORE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "STORE_HAS_HISTORY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Store cannot be deleted because it has cards or interaction history",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};