import crypto from "crypto";

import type {
  Request,
  Response,
} from "express";

export async function getTawkIdentity(
  req: Request,
  res: Response
) {
  const user =
    req.user;

  if (!user) {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Unauthorized",
      });
  }

  const apiKey =
    process.env
      .TAWK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TAWK_API_KEY is not configured"
    );
  }

  const email =
    user.email
      .trim()
      .toLowerCase();

  const userId =
    user.id;
  const hash =
    crypto
      .createHmac(
        "sha256",
        apiKey
      )
      .update(userId)
      .digest("hex");

  return res.json({
    success: true,

    data: {
      userId:
        user.id,

      name:
        user.name,

      email:
        user.email
          .trim()
          .toLowerCase(),

      hash,
    },
  });
}