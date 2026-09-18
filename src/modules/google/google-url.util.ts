const ALLOWED_GOOGLE_HOSTS =
  new Set([
    "g.page",
    "maps.app.goo.gl",
    "goo.gl",
    "google.com",
    "www.google.com",
    "maps.google.com",
    "search.google.com",
  ]);

function normalizeHostname(
  hostname: string
) {
  return hostname
    .trim()
    .toLowerCase();
}

export function isAllowedGoogleHostname(
  hostname: string
) {
  const normalized =
    normalizeHostname(
      hostname
    );

  if (
    ALLOWED_GOOGLE_HOSTS.has(
      normalized
    )
  ) {
    return true;
  }

  return normalized.endsWith(
    ".google.com"
  );
}

export function validateGoogleUrl(
  value:
    string
) {
  let url:
    URL;

  try {
    url =
      new URL(
        value
      );
  } catch {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  /*
   * HTTPS only.
   */
  if (
    url.protocol !==
    "https:"
  ) {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  /*
   * Never allow URLs like:
   *
   * https://user:pass@google.com
   */
  if (
    url.username !==
    "" ||
    url.password !==
    ""
  ) {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  /*
   * Don't allow unexpected ports:
   *
   * https://google.com:8443
   */
  if (
    url.port !==
    "" &&
    url.port !==
    "443"
  ) {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  if (
    !isAllowedGoogleHostname(
      url.hostname
    )
  ) {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  return url;
}
export function extractPlaceIdFromGoogleUrl(
  value: string
): string | null {
  let url: URL;

  try {
    url =
      validateGoogleUrl(
        value
      );
  } catch {
    return null;
  }

  const keys = [
    "place_id",
    "placeid",
    "query_place_id",
    "destination_place_id",
    "origin_place_id",
  ];

  for (
    const key of keys
  ) {
    const value =
      url.searchParams.get(
        key
      );

    if (
      value?.trim()
    ) {
      return value.trim();
    }
  }

  const query =
    url.searchParams.get(
      "query"
    );

  if (
    query?.startsWith(
      "place_id:"
    )
  ) {
    return query
      .slice(
        "place_id:".length
      )
      .trim();
  }

  return null;
}

export async function resolveGoogleUrl(
  originalUrl: string
): Promise<string> {
  let currentUrl =
    validateGoogleUrl(
      originalUrl
    );

  for (
    let count = 0;
    count < 5;
    count++
  ) {
    const response =
      await fetch(
        currentUrl.toString(),
        {
          method: "GET",

          redirect:
            "manual",

          signal:
            AbortSignal.timeout(
              5000
            ),

          headers: {
            "User-Agent":
              "ValYou/1.0",
          },
        }
      );

    await response.body
      ?.cancel();

    if (
      response.status < 300 ||
      response.status >= 400
    ) {
      return currentUrl.toString();
    }

    const location =
      response.headers.get(
        "location"
      );

    if (!location) {
      return currentUrl.toString();
    }

    const nextUrl =
      new URL(
        location,
        currentUrl
      );

    /*
     * Never follow a redirect
     * outside Google domains.
     */
    validateGoogleUrl(
      nextUrl.toString()
    );

    currentUrl =
      nextUrl;
  }

  return currentUrl.toString();
}