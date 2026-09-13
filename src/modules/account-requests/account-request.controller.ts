import type {
    NextFunction,
    Request,
    Response,
  } from "express";
  
  import {
    adminAccountRequestQuerySchema,
    createAccountRequestSchema,
    updateAccountRequestSchema,
  } from "./account-request.schema.js";
  
  import {
    createAccountRequest,
    getAdminAccountRequests,
    updateAccountRequest,
  } from "./account-request.service.js";
  
  export async function createAccountRequestController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const parsed =
        createAccountRequestSchema.safeParse(
          req.body
        );
  
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            success: false,
  
            code:
              "INVALID_ACCOUNT_REQUEST",
  
            message:
              "Please check the request form.",
  
            errors:
              parsed.error.flatten(),
          });
      }
  
      /*
       * Honeypot filled.
       *
       * Pretend it succeeded so
       * bots don't learn anything.
       */
      if (
        parsed.data.website
          ?.trim()
      ) {
        return res.json({
          success:
            true,
  
          message:
            "Your request has been received.",
        });
      }
  
      const result =
        await createAccountRequest({
          ownerName:
            parsed.data.ownerName,
  
          phone:
            parsed.data.phone,
  
          shopName:
            parsed.data.shopName,
  
          businessType:
            parsed.data.businessType,
  
          requestedCards:
            parsed.data.requestedCards,
  
          message:
            parsed.data.message,
        });
  
      return res
        .status(
          result.duplicate
            ? 200
            : 201
        )
        .json({
          success:
            true,
  
          message:
            result.duplicate
              ? "We already received this request and will contact you soon."
              : "Your request has been received. The ValYou team will contact you soon.",
        });
    } catch (error) {
      return next(
        error
      );
    }
  }
  
  export async function getAdminAccountRequestsController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const parsed =
        adminAccountRequestQuerySchema.safeParse(
          req.query
        );
  
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            success: false,
  
            code:
              "INVALID_ACCOUNT_REQUEST_QUERY",
  
            message:
              "Invalid request query.",
          });
      }
  
      const result =
        await getAdminAccountRequests(
          parsed.data
        );
  
      return res.json({
        success:
          true,
  
        data:
          result,
      });
    } catch (error) {
      return next(
        error
      );
    }
  }
  
  export async function updateAccountRequestController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const parsed =
        updateAccountRequestSchema.safeParse(
          req.body
        );
  
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            success: false,
  
            code:
              "INVALID_ACCOUNT_REQUEST_UPDATE",
  
            message:
              "Invalid request update.",
  
            errors:
              parsed.error.flatten(),
          });
      }
  
      const request =
        await updateAccountRequest(
          req.params.requestId as string,
  
          parsed.data,
  
          req.user!.id
        );
  
      return res.json({
        success:
          true,
  
        data:
          request,
      });
    } catch (error) {
      if (
        error instanceof
          Error &&
        error.message ===
          "ACCOUNT_REQUEST_NOT_FOUND"
      ) {
        return res
          .status(404)
          .json({
            success: false,
  
            code:
              "ACCOUNT_REQUEST_NOT_FOUND",
  
            message:
              "Account request not found.",
          });
      }
  
      return next(
        error
      );
    }
  }