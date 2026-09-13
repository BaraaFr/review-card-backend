import type {
    Request,
  } from "express";
  
  import {
    UAParser,
  } from "ua-parser-js";
  
  export type InteractionDeviceType =
    | "MOBILE"
    | "TABLET"
    | "DESKTOP"
    | "UNKNOWN";
  
  export type InteractionRequestMetadata = {
    deviceType:
      InteractionDeviceType;
  
    browser:
      | string
      | null;
  
    operatingSystem:
      | string
      | null;
  
    language:
      | string
      | null;
  
    isBot:
      boolean;
  };
  
  /*
   * =======================================================
   * Device type
   * =======================================================
   */
  
  function resolveDeviceType(
    deviceType:
      | string
      | undefined,
  
    userAgent: string
  ): InteractionDeviceType {
    if (
      deviceType ===
      "mobile"
    ) {
      return "MOBILE";
    }
  
    if (
      deviceType ===
      "tablet"
    ) {
      return "TABLET";
    }
  
    /*
     * If UAParser doesn't identify
     * a mobile/tablet type but a normal
     * browser UA exists, treat it as
     * desktop.
     */
    if (
      userAgent.trim()
    ) {
      return "DESKTOP";
    }
  
    return "UNKNOWN";
  }
  
  /*
   * =======================================================
   * Preferred browser language
   * =======================================================
   *
   * Example:
   *
   * Accept-Language:
   * ar-LB,ar;q=0.9,en;q=0.8
   *
   * We store:
   *
   * ar-LB
   * =======================================================
   */
  
  function getPrimaryLanguage(
    acceptLanguage:
      | string
      | undefined
  ) {
    if (
      !acceptLanguage
    ) {
      return null;
    }
  
    const firstLanguage =
      acceptLanguage
        .split(",")[0]
        ?.split(";")[0]
        ?.trim();
  
    if (
      !firstLanguage
    ) {
      return null;
    }
  
    /*
     * Avoid storing a malformed /
     * unexpectedly huge header.
     */
    return firstLanguage.slice(
      0,
      32
    );
  }
  
  /*
   * =======================================================
   * Basic bot detection
   * =======================================================
   *
   * This is intentionally simple.
   *
   * It will not catch every bot.
   *
   * It is just useful for keeping obvious
   * crawlers out of meaningful analytics.
   * =======================================================
   */
  
  function isBotUserAgent(
    userAgent: string
  ) {
    if (
      !userAgent
    ) {
      return false;
    }
  
    return /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|python-requests|curl|wget/i.test(
      userAgent
    );
  }
  
  /*
   * =======================================================
   * Public helper
   * =======================================================
   */
  
  export function getInteractionRequestMetadata(
    req: Request
  ): InteractionRequestMetadata {
    const userAgent =
      req.get(
        "user-agent"
      ) ??
      "";
  
    const parser =
      new UAParser(
        userAgent
      );
  
    const result =
      parser.getResult();
  
    const browser =
      result.browser.name
        ?.trim()
        .slice(
          0,
          80
        ) ||
      null;
  
    const operatingSystem =
      result.os.name
        ?.trim()
        .slice(
          0,
          80
        ) ||
      null;
  
    const deviceType =
      resolveDeviceType(
        result.device.type,
        userAgent
      );
  
    const language =
      getPrimaryLanguage(
        req.get(
          "accept-language"
        )
      );
  
    const isBot =
      isBotUserAgent(
        userAgent
      );
  
    return {
      deviceType,
  
      browser,
  
      operatingSystem,
  
      language,
  
      isBot,
    };
  }