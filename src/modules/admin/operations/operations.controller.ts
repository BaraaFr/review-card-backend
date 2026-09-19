import type {
    NextFunction,
    Request,
    Response,
  } from "express";
  
  import {
    operationsService,
  } from "./operations.service.js";
  
  export async function getOperationalHealth(
    _req:
      Request,
  
    res:
      Response,
  
    next:
      NextFunction
  ) {
    try {
      const health =
        await operationsService
          .getHealth();
  
      /*
       * Always return HTTP 200.
       *
       * This is a diagnostic/admin endpoint,
       * not the load-balancer readiness probe.
       *
       * Operational status lives in:
       *
       * data.health.status
       */
      return res
        .status(200)
        .json({
          success:
            true,
  
          data: {
            health,
          },
        });
    } catch (
      error
    ) {
      return next(
        error
      );
    }
  }