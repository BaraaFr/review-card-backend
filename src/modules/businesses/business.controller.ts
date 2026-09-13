import type {
    Request,
    Response,
  } from "express";
  
  import {
    createBusinessSchema,
    updateBusinessSchema,
  } from "./business.schema.js";
  
  import { businessService } from "./business.service.js";
  
  export const createBusiness = async (
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
        createBusinessSchema.safeParse(req.body);
  
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors:
            validation.error.flatten().fieldErrors,
        });
      }
  
      const business =
        await businessService.create(
          req.user,
          validation.data
        );
  
      return res.status(201).json({
        success: true,
        message: "Business created successfully",
        data: {
          business,
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
  
  export const getBusinesses = async (
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
  
      const businesses =
        await businessService.findAll(req.user);
  
      return res.status(200).json({
        success: true,
        data: {
          businesses,
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
  
  export const getBusiness = async (
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
  
      const business =
        await businessService.findById(
          req.user,
          req.params.id as string
        );
  
      if (!business) {
        return res.status(404).json({
          success: false,
          message: "Business not found",
        });
      }
  
      return res.status(200).json({
        success: true,
        data: {
          business,
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
  
  export const updateBusiness = async (
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
        updateBusinessSchema.safeParse(req.body);
  
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors:
            validation.error.flatten().fieldErrors,
        });
      }
  
      const business =
        await businessService.update(
          req.user,
          req.params.id as string,
          validation.data
        );
  
      return res.status(200).json({
        success: true,
        message: "Business updated successfully",
        data: {
          business,
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