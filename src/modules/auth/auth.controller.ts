import type { NextFunction, Request, Response } from "express";
import { establishSession } from "./establish-session.js";
import { activateAccountSchema, loginSchema } from "./auth.schema.js";
import { AuthError, authService, type AuthErrorCode } from "./auth.service.js";

const authResponses: Record<AuthErrorCode, { status: number; message: string }> = {
  INVALID_CREDENTIALS: { status: 401, message: "Invalid email or password." },
  ACCOUNT_DISABLED: { status: 403, message: "This account is disabled." },
  ACCOUNT_NOT_ACTIVE: { status: 403, message: "Please activate your account before logging in." },
  INVALID_OR_EXPIRED_INVITATION: { status: 400, message: "This activation link is invalid or has expired." },
  ACCOUNT_ALREADY_ACTIVE: { status: 409, message: "This account is already active." },
  INVITATION_ALREADY_USED: { status: 409, message: "This activation link has already been used." },
};

function handleAuthError(error: unknown, res: Response, next: NextFunction) {
  if (!(error instanceof AuthError)) return next(error);
  const response = authResponses[error.code];
  return res.status(response.status).json({
    success: false, code: error.code, message: response.message,
  });
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false, code: "INVALID_LOGIN_DATA",
        message: "Please provide a valid email and password.",
        errors: parsed.error.flatten(),
      });
    }
    const user = await authService.login(parsed.data);
    await establishSession(res, user, req.get("user-agent"));
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, message: "Logged in successfully.", user });
  } catch (error) {
      console.log("error",error)
    return handleAuthError(error, res, next);
  }
}

export async function activateAccountController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = activateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false, code: "INVALID_ACTIVATION_DATA",
        message: "Invalid account activation data.", errors: parsed.error.flatten(),
      });
    }
    const user = await authService.activateAccount(parsed.data);
    await establishSession(res, user, req.get("user-agent"));
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, message: "Account activated successfully.", user });
  } catch (error) {
    return handleAuthError(error, res, next);
  }
}

export async function meController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    return res
      .status(401)
      .json({
        success: false,

        code:
          "AUTHENTICATION_REQUIRED",

        message:
          "Authentication required.",
      });
  }

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  return res.json({
    success: true,

    user: {
      id:
        req.user.id,

      name:
        req.user.name,

      email:
        req.user.email,

      role:
        req.user.role,

      status: req.user.status,
    },
  });
}