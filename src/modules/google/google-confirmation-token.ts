import {
    createHash,
    createHmac,
    timingSafeEqual,
  } from "node:crypto";
  
  import {
    env,
  } from "../../config/env.js";
  
  type ConfirmationPayload = {
    version: 1;
  
    storeId: string;
  
    userId: string;
  
    googleReviewUrlHash: string;
  
    allowedPlaceIds: string[];
  
    expiresAt: number;
  };
  
  const TOKEN_LIFETIME_MS =
    10 * 60 * 1000;
  
  function getSigningKey() {
    /*
     * Domain separation:
     * even though JWT_SECRET is reused,
     * this creates a purpose-specific
     * HMAC key for Google confirmation.
     */
    return createHmac(
      "sha256",
      env.JWT_SECRET
    )
      .update(
        "tapreview-google-place-confirmation-v1"
      )
      .digest();
  }
  
  function sign(
    encodedPayload: string
  ) {
    return createHmac(
      "sha256",
      getSigningKey()
    )
      .update(
        encodedPayload
      )
      .digest(
        "base64url"
      );
  }
  
  export function hashGoogleReviewUrl(
    value: string
  ) {
    return createHash(
      "sha256"
    )
      .update(value)
      .digest("hex");
  }
  
  export function createGoogleConfirmationToken(
    input: {
      storeId: string;
  
      userId: string;
  
      googleReviewUrl: string;
  
      allowedPlaceIds: string[];
    }
  ) {
    const payload:
      ConfirmationPayload = {
      version: 1,
  
      storeId:
        input.storeId,
  
      userId:
        input.userId,
  
      googleReviewUrlHash:
        hashGoogleReviewUrl(
          input.googleReviewUrl
        ),
  
      allowedPlaceIds:
        input.allowedPlaceIds,
  
      expiresAt:
        Date.now() +
        TOKEN_LIFETIME_MS,
    };
  
    const encodedPayload =
      Buffer.from(
        JSON.stringify(
          payload
        )
      ).toString(
        "base64url"
      );
  
    const signature =
      sign(
        encodedPayload
      );
  
    return `${encodedPayload}.${signature}`;
  }
  
  export function verifyGoogleConfirmationToken(
    token: string
  ): ConfirmationPayload {
    const [
      encodedPayload,
      suppliedSignature,
    ] =
      token.split(".");
  
    if (
      !encodedPayload ||
      !suppliedSignature
    ) {
      throw new Error(
        "INVALID_GOOGLE_CONFIRMATION_TOKEN"
      );
    }
  
    const expectedSignature =
      sign(
        encodedPayload
      );
  
    const expectedBuffer =
      Buffer.from(
        expectedSignature
      );
  
    const suppliedBuffer =
      Buffer.from(
        suppliedSignature
      );
  
    if (
      expectedBuffer.length !==
      suppliedBuffer.length
    ) {
      throw new Error(
        "INVALID_GOOGLE_CONFIRMATION_TOKEN"
      );
    }
  
    if (
      !timingSafeEqual(
        expectedBuffer,
        suppliedBuffer
      )
    ) {
      throw new Error(
        "INVALID_GOOGLE_CONFIRMATION_TOKEN"
      );
    }
  
    let payload:
      ConfirmationPayload;
  
    try {
      payload =
        JSON.parse(
          Buffer.from(
            encodedPayload,
            "base64url"
          ).toString(
            "utf8"
          )
        );
    } catch {
      throw new Error(
        "INVALID_GOOGLE_CONFIRMATION_TOKEN"
      );
    }
  
    if (
      payload.version !== 1 ||
      !payload.storeId ||
      !payload.userId ||
      !payload.googleReviewUrlHash ||
      !Array.isArray(
        payload.allowedPlaceIds
      )
    ) {
      throw new Error(
        "INVALID_GOOGLE_CONFIRMATION_TOKEN"
      );
    }
  
    if (
      payload.expiresAt <
      Date.now()
    ) {
      throw new Error(
        "GOOGLE_CONFIRMATION_EXPIRED"
      );
    }
  
    return payload;
  }