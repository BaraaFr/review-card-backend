import { env } from "../config/env.js";

const baseUrl =
  env.PUBLIC_API_URL.replace(/\/$/, "");

export const getCardUrls = (
  code: string
) => {
  const redirectUrl =
    `${baseUrl}/r/${code}`;

  return {
    redirectUrl,

    qrUrl:
      `${redirectUrl}?source=qr`,

    nfcUrl:
      `${redirectUrl}?source=nfc`,
  };
};