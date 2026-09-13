import type {
    Request,
    Response,
  } from "express";
  
  import {
    adminOverviewService,
  } from "./overview.service.js";
  
  export async function getAdminOverview(
    _req: Request,
    res: Response
  ) {
    try {
      const overview =
        await adminOverviewService
          .getOverview();
  
      return res.json({
        success: true,
  
        data: {
          overview,
        },
      });
    } catch (error) {
      console.error(
        "Admin overview error:",
        error
      );
  
      return res.status(500).json({
        success: false,
  
        message:
          "Unable to load admin overview",
      });
    }
  }