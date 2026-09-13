import {
    createHash,
    randomBytes,
  } from "node:crypto";
  
  export function generateActivationToken() {
    return randomBytes(32)
      .toString("hex");
  }
  
  export function hashActivationToken(
    token: string
  ) {
    return createHash("sha256")
      .update(token)
      .digest("hex");
  }