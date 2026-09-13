import type {
  Request,
  Response,
} from "express";

import QRCode from "qrcode";

import {
  assignCardSchema,
  createCardSchema,
  listCardsQuerySchema,
  updateCardSchema,
} from "./card.schema.js";

import { cardService } from "./card.service.js";

export const createCard = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      createCardSchema.safeParse(
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

    const card =
      await cardService.create(
        validation.data
      );

    return res.status(201).json({
      success: true,
      message:
        "Card created successfully",
      data: {
        card,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const getCards = async (
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

    const validation =
      listCardsQuerySchema.safeParse(
        req.query
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid query parameters",
      });
    }

    const result =
      await cardService.findAll(
        req.user,
        validation.data
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const getCard = async (
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

    const card =
      await cardService.findById(
        req.user,
        req.params.id as string
      );

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        card,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const updateCard = async (
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

    const validation =
      updateCardSchema.safeParse(
        req.body
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          "Validation failed",
      });
    }

    const card =
      await cardService.update(
        req.user,
        req.params.id as string,
        validation.data
      );

    return res.status(200).json({
      success: true,
      message:
        "Card updated successfully",
      data: {
        card,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
      "CARD_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const assignCard = async (
  req: Request,
  res: Response
) => {
  try {
    const validation =
      assignCardSchema.safeParse(
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

    const card =
      await cardService.assign(
        req.params.id as string,
        validation.data
      );

    return res.status(200).json({
      success: true,
      message:
        "Card assigned successfully",
      data: {
        card,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
      "SUBSCRIPTION_REQUIRED"
    ) {
      return res.status(403).json({
        success: false,

        message:
          "The business requires an active subscription",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
      "CARD_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
      "CARD_LIMIT_REACHED"
    ) {
      return res.status(403).json({
        success: false,

        message:
          "The subscription card limit has been reached",
      });
    }
    if (
      error instanceof Error &&
      error.message ===
      "STORE_REVIEW_URL_REQUIRED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Store must have a Google review URL before assigning a card",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const unassignCard = async (
  req: Request,
  res: Response
) => {
  try {
    const card =
      await cardService.unassign(
        req.params.id as string
      );

    return res.status(200).json({
      success: true,
      message:
        "Card unassigned successfully",
      data: {
        card,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
      "CARD_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

export const getCardQr = async (
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

    const card =
      await cardService.findById(
        req.user,
        req.params.id as string
      );

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    const svg =
      await QRCode.toString(
        card.urls.qrUrl,
        {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 2,
        }
      );

    res.setHeader(
      "Content-Type",
      "image/svg+xml"
    );

    return res.status(200).send(svg);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate QR code",
    });
  }
};