import type {
    NextFunction,
    Request,
    Response,
  } from "express";
  
  type UserRole =
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
  
  export const authorize = (
    ...roles: UserRole[]
  ) => {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }
  
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to perform this action",
        });
      }
  
      next();
    };
  };