import type {
    Request,
    Response,
  } from "express";
  
import { subscriptionService } from "./subscription.service.js";
  
  export async function listAdminSubscriptions(
    _req: Request,
    res: Response
  ) {
    try {
      const subscriptions =
        await subscriptionService
          .listAll();
  
      return res.json({
        success: true,
  
        data: {
          subscriptions,
        },
      });
    } catch (error) {
      console.error(
        "Admin subscriptions error:",
        error
      );
  
      return res.status(500).json({
        success: false,
  
        message:
          "Unable to load subscriptions",
      });
    }
  }