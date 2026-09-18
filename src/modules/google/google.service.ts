import {
    env,
} from "../../config/env.js";

import {
    prisma,
} from "../../lib/prisma.js";

import {
    createGoogleConfirmationToken,
    hashGoogleReviewUrl,
    verifyGoogleConfirmationToken,
} from "./google-confirmation-token.js";
import {
    googleFetch,
  } from "./google-fetch.js";
  
  import {
    DomainError,
  } from "../../lib/domain-error.js";

import {
    extractPlaceIdFromGoogleUrl,
    resolveGoogleUrl,
    validateGoogleUrl,
} from "./google-url.util.js";

import type {
    GoogleConnectResult,
    GoogleConnectedResult,
    GoogleConnectionCandidate,
    GooglePlaceDetails,
    GooglePlaceSearchResult,
    GooglePlacesSearchResponse,
} from "./google.types.js";

const GOOGLE_PLACES_BASE_URL =
    "https://places.googleapis.com/v1";

function normalizeText(
    value?:
        | string
        | null
) {
    return (
        value ?? ""
    )
        .normalize("NFKD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .replace(
            /[^a-z0-9\u0600-\u06ff]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function tokenize(
    value: string
) {
    return new Set(
        normalizeText(
            value
        )
            .split(" ")
            .filter(
                (token) =>
                    token.length >= 2
            )
    );
}

function similarity(
    first: string,
    second: string
) {
    const a =
        tokenize(first);

    const b =
        tokenize(second);

    if (
        a.size === 0 ||
        b.size === 0
    ) {
        return 0;
    }

    let matching =
        0;

    for (
        const token of a
    ) {
        if (
            b.has(token)
        ) {
            matching++;
        }
    }

    return (
        matching /
        Math.max(
            a.size,
            b.size
        )
    );
}

function nameSimilarity(
    googleName: string,
    expectedName: string
) {
    const google =
        normalizeText(
            googleName
        );

    const expected =
        normalizeText(
            expectedName
        );

    if (
        !google ||
        !expected
    ) {
        return 0;
    }

    if (
        google ===
        expected
    ) {
        return 1;
    }

    if (
        google.includes(
            expected
        ) ||
        expected.includes(
            google
        )
    ) {
        return 0.9;
    }

    return similarity(
        google,
        expected
    );
}

function calculateCandidateScore(
    candidate:
        GooglePlaceSearchResult,
    input: {
        businessName: string;
        storeName: string;
        address?: string | null;
    }
) {
    const candidateName =
        candidate.displayName
            ?.text ??
        "";

    const businessScore =
        nameSimilarity(
            candidateName,
            input.businessName
        );

    const storeScore =
        nameSimilarity(
            candidateName,
            input.storeName
        );

    const bestNameScore =
        Math.max(
            businessScore,
            storeScore
        );

    const addressScore =
        input.address &&
            candidate.formattedAddress
            ? similarity(
                candidate.formattedAddress,
                input.address
            )
            : 0;

    /*
     * For branch matching:
     *
     * Name    55%
     * Address 40%
     * Store    5%
     *
     * Address receives much more
     * weight than before because
     * multiple branches can have
     * exactly the same business name.
     */
    const totalScore =
        bestNameScore *
        0.55 +
        addressScore *
        0.4 +
        storeScore *
        0.05;

    return {
        totalScore,
        businessScore,
        storeScore,
        addressScore,
    };
}

async function getStoreForUser(
    storeId: string,
    user: {
        id: string;

        role:
        | "SUPER_ADMIN"
        | "BUSINESS_OWNER";
    }
) {
    const store =
        await prisma.store.findUnique({
            where: {
                id: storeId,
            },

            include: {
                business: {
                    select: {
                        id: true,
                        name: true,
                        ownerId: true,
                    },
                },
            },
        });

    if (!store) {
        throw new Error(
            "STORE_NOT_FOUND"
        );
    }

    if (
        user.role !==
        "SUPER_ADMIN" &&
        store.business.ownerId !==
        user.id
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    return store;
}

async function getGooglePlaceIdentity(
    placeId: string
): Promise<GooglePlaceDetails> {
    const response =
        await googleFetch(
            `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(
                placeId
            )}`,
            {
                method: "GET",

                headers: {
                    "X-Goog-Api-Key":
                        env.GOOGLE_PLACES_API_KEY,

                    "X-Goog-FieldMask": [
                        "id",
                        "displayName",
                        "formattedAddress",
                    ].join(","),
                },

                signal:
                    AbortSignal.timeout(
                        8000
                    ),
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        console.error(
            "Google Place identity request failed:",
            response.status,
            body
        );

        throw new Error(
            "GOOGLE_PLACE_FETCH_FAILED"
        );
    }

    return (
        await response.json()
    ) as GooglePlaceDetails;
}

export async function fetchGooglePlaceDetails(
    placeId: string
): Promise<GooglePlaceDetails> {
    const response =
        await googleFetch(
            `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(
                placeId
            )}`,
            {
                method: "GET",

                headers: {
                    "X-Goog-Api-Key":
                        env.GOOGLE_PLACES_API_KEY,

                    "X-Goog-FieldMask": [
                        "id",
                        "displayName",
                        "formattedAddress",
                        "rating",
                        "userRatingCount",
                        "googleMapsUri",
                        "reviews",
                    ].join(","),
                },

                signal:
                    AbortSignal.timeout(
                        8000
                    ),
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        console.error(
            "Google Place Details failed:",
            response.status,
            body
        );

        throw new Error(
            "GOOGLE_PLACE_FETCH_FAILED"
        );
    }

    return (
        await response.json()
    ) as GooglePlaceDetails;
}

async function searchGoogleCandidates(
    query: string
): Promise<
    GooglePlaceSearchResult[]
> {
    const response =
        await googleFetch(
            `${GOOGLE_PLACES_BASE_URL}/places:searchText`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "X-Goog-Api-Key":
                        env.GOOGLE_PLACES_API_KEY,

                    /*
                     * Only request fields used
                     * for matching.
                     */
                    "X-Goog-FieldMask": [
                        "places.id",
                        "places.displayName",
                        "places.formattedAddress",
                    ].join(","),
                },

                body:
                    JSON.stringify({
                        textQuery:
                            query,

                        regionCode:
                            "LB",

                        pageSize:
                            5,
                    }),

                signal:
                    AbortSignal.timeout(
                        8000
                    ),
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        console.error(
            "Google Text Search failed:",
            response.status,
            body
        );

        throw new Error(
            "GOOGLE_PLACE_SEARCH_FAILED"
        );
    }

    const data =
        (await response.json()) as
        GooglePlacesSearchResponse;

    return (
        data.places ??
        []
    );
}

async function resolvePlaceIdFromGoogleUrl(
    googleReviewUrl: string
) {
    const direct =
        extractPlaceIdFromGoogleUrl(
            googleReviewUrl
        );

    if (direct) {
        return direct;
    }

    try {
        const resolvedUrl =
            await resolveGoogleUrl(
                googleReviewUrl
            );

        return extractPlaceIdFromGoogleUrl(
            resolvedUrl
        );
    } catch (error) {
        console.warn(
            "Unable to resolve Google URL:",
            error
        );

        return null;
    }
}

async function saveGoogleConnection(
    store: {
      id:
        string;
  
      updatedAt:
        Date;
  
      name:
        string;
  
      googleReviewUrl:
        | string
        | null;
    },
  
    place:
      GooglePlaceDetails,
  
    mode:
      | "EXACT_URL"
      | "CONFIRMED",
  
    actorId:
      string
  ): Promise<GoogleConnectedResult> {
    if (
      !store.googleReviewUrl
    ) {
      throw new Error(
        "GOOGLE_REVIEW_URL_REQUIRED"
      );
    }
  
    const now =
      new Date();
  
    const updatedStore =
      await prisma
        .$transaction(
          async (
            tx
          ) => {
            /*
             * Optimistic concurrency check.
             *
             * If store.updatedAt or the Google URL
             * changed since we started talking to
             * Google, this update fails.
             */
            const updated =
              await tx.store
                .update({
                  where: {
                    id:
                      store.id,
  
                    updatedAt:
                      store.updatedAt,
  
                    googleReviewUrl:
                      store.googleReviewUrl,
                  },
  
                  data: {
                    googlePlaceId:
                      place.id,
  
                    googlePlaceConnectedFromUrl:
                      store.googleReviewUrl,
  
                    googlePlaceConnectedAt:
                      now,
                  },
                });
  
            /*
             * Administrative/security audit.
             */
            await tx.auditEvent
              .create({
                data: {
                  actorId,
  
                  operation:
                    "GOOGLE_CONNECT",
  
                  target:
                    store.id,
  
                  details: {
                    placeId:
                      place.id,
  
                    reviewUrl:
                      store.googleReviewUrl,
  
                    mode,
                  },
                },
              });
  
            return updated;
          }
        )
        .catch(
          (
            error:
              unknown
          ) => {
            /*
             * Prisma update couldn't find
             * a row matching the original
             * state.
             */
            if (
              (
                error as {
                  code?:
                    string;
                }
              ).code ===
                "P2025"
            ) {
              throw new DomainError(
                409,
  
                "GOOGLE_CONFIRMATION_STALE",
  
                "Location changed while connecting. Please connect again."
              );
            }
  
            throw error;
          }
        );
  
    return {
      status:
        "CONNECTED",
  
      connectionMode:
        mode,
  
      store: {
        id:
          updatedStore.id,
  
        name:
          updatedStore.name,
  
        googleReviewUrl:
          updatedStore.googleReviewUrl,
  
        googlePlaceId:
          updatedStore.googlePlaceId,
  
        googlePlaceConnectedFromUrl:
          updatedStore.googlePlaceConnectedFromUrl,
  
        googlePlaceConnectedAt:
          updatedStore.googlePlaceConnectedAt,
      },
  
      googlePlace: {
        id:
          place.id,
  
        name:
          place.displayName
            ?.text ??
          null,
  
        address:
          place.formattedAddress ??
          null,
      },
    };
  }

function toCandidate(
    place:
        GooglePlaceSearchResult
): GoogleConnectionCandidate {
    return {
        placeId:
            place.id,

        name:
            place.displayName
                ?.text ??
            "Google Business",

        address:
            place.formattedAddress ??
            null,
    };
}

export async function connectGooglePlace(
    storeId: string,
    user: {
        id: string;

        role:
        | "SUPER_ADMIN"
        | "BUSINESS_OWNER";
    }
): Promise<GoogleConnectResult> {
    const store =
        await getStoreForUser(
            storeId,
            user
        );

    if (
        !store.googleReviewUrl
    ) {
        throw new Error(
            "GOOGLE_REVIEW_URL_REQUIRED"
        );
    }

    validateGoogleUrl(
        store.googleReviewUrl
    );

    /*
     * Already connected using the
     * exact same Google Review URL.
     */
    if (
        store.googlePlaceId &&
        store.googlePlaceConnectedFromUrl ===
        store.googleReviewUrl
    ) {
        const place =
            await getGooglePlaceIdentity(
                store.googlePlaceId
            );

        return saveGoogleConnection(
            store,
            place,
            "EXACT_URL",
            user.id
        );
    }

    /*
     * --------------------------------
     * 1. EXACT PLACE ID FROM URL
     * --------------------------------
     */

    const exactPlaceId =
        await resolvePlaceIdFromGoogleUrl(
            store.googleReviewUrl
        );

    if (exactPlaceId) {
        const exactPlace =
            await getGooglePlaceIdentity(
                exactPlaceId
            );

        const scores =
            calculateCandidateScore(
                {
                    id:
                        exactPlace.id,

                    displayName:
                        exactPlace.displayName,

                    formattedAddress:
                        exactPlace.formattedAddress,
                },
                {
                    businessName:
                        store.business.name,

                    storeName:
                        store.name,

                    address:
                        store.address,
                }
            );

        /*
         * Auto-connect ONLY when:
         *
         * - Place ID came from Google URL
         * - name is reasonably consistent
         * - we have an address
         * - address also looks consistent
         *
         * Otherwise ask the owner to
         * confirm the exact listing.
         */
        const canAutoConnect =
            scores.businessScore >=
            0.5 &&
            Boolean(
                store.address
            ) &&
            scores.addressScore >=
            0.25;

        if (canAutoConnect) {
            return saveGoogleConnection(
                store,
                exactPlace,
                "EXACT_URL",
                user.id
            );
        }

        const candidates = [
            toCandidate({
                id:
                    exactPlace.id,

                displayName:
                    exactPlace.displayName,

                formattedAddress:
                    exactPlace.formattedAddress,
            }),
        ];

        return {
            status:
                "CONFIRMATION_REQUIRED",

            candidates,

            confirmationToken:
                createGoogleConfirmationToken(
                    {
                        storeId:
                            store.id,

                        userId:
                            user.id,

                        googleReviewUrl:
                            store.googleReviewUrl,

                        allowedPlaceIds:
                            candidates.map(
                                (
                                    candidate
                                ) =>
                                    candidate.placeId
                            ),
                    }
                ),
        };
    }

    /*
     * --------------------------------
     * 2. FALLBACK TEXT SEARCH
     * --------------------------------
     *
     * IMPORTANT:
     *
     * Search results are NEVER
     * automatically saved.
     */

    const query = [
        store.business.name,
        store.name,
        store.address,
        "Lebanon",
    ]
        .filter(
            (
                value
            ): value is string =>
                Boolean(
                    value?.trim()
                )
        )
        .join(" ");

    const searchResults =
        await searchGoogleCandidates(
            query
        );

    if (
        searchResults.length ===
        0
    ) {
        return {
            status:
                "NOT_FOUND",
        };
    }

    const ranked =
        searchResults
            .map(
                (
                    candidate
                ) => {
                    const scores =
                        calculateCandidateScore(
                            candidate,
                            {
                                businessName:
                                    store.business
                                        .name,

                                storeName:
                                    store.name,

                                address:
                                    store.address,
                            }
                        );

                    return {
                        candidate,
                        ...scores,
                    };
                }
            )

            /*
             * Remove obviously unrelated
             * Google results.
             */
            .filter(
                (
                    item
                ) =>
                    item.businessScore >=
                    0.25 ||
                    item.storeScore >=
                    0.25 ||
                    item.addressScore >=
                    0.2
            )

            .sort(
                (
                    first,
                    second
                ) =>
                    second.totalScore -
                    first.totalScore
            )

            /*
             * Never overwhelm owner.
             */
            .slice(
                0,
                3
            );

    if (
        ranked.length ===
        0
    ) {
        return {
            status:
                "NOT_FOUND",
        };
    }

    const candidates =
        ranked.map(
            (
                item
            ) =>
                toCandidate(
                    item.candidate
                )
        );

    return {
        status:
            "CONFIRMATION_REQUIRED",

        candidates,

        confirmationToken:
            createGoogleConfirmationToken(
                {
                    storeId:
                        store.id,

                    userId:
                        user.id,

                    googleReviewUrl:
                        store.googleReviewUrl,

                    allowedPlaceIds:
                        candidates.map(
                            (
                                candidate
                            ) =>
                                candidate.placeId
                        ),
                }
            ),
    };
}

export async function confirmGooglePlace(
    input: {
        storeId: string;

        placeId: string;

        confirmationToken: string;

        user: {
            id: string;

            role:
            | "SUPER_ADMIN"
            | "BUSINESS_OWNER";
        };
    }
) {
    const payload =
        verifyGoogleConfirmationToken(
            input.confirmationToken
        );

    if (
        payload.storeId !==
        input.storeId
    ) {
        throw new Error(
            "INVALID_GOOGLE_CONFIRMATION_TOKEN"
        );
    }

    if (
        payload.userId !==
        input.user.id
    ) {
        throw new Error(
            "INVALID_GOOGLE_CONFIRMATION_TOKEN"
        );
    }

    if (
        !payload.allowedPlaceIds.includes(
            input.placeId
        )
    ) {
        throw new Error(
            "GOOGLE_PLACE_NOT_ALLOWED"
        );
    }

    const store =
        await getStoreForUser(
            input.storeId,
            input.user
        );

    if (
        !store.googleReviewUrl
    ) {
        throw new Error(
            "GOOGLE_REVIEW_URL_REQUIRED"
        );
    }

    /*
     * If owner edited the Google URL
     * after candidates were generated,
     * invalidate the old confirmation.
     */
    if (
        hashGoogleReviewUrl(
            store.googleReviewUrl
        ) !==
        payload.googleReviewUrlHash
    ) {
        throw new Error(
            "GOOGLE_CONFIRMATION_STALE"
        );
    }

    /*
     * Validate selected Place ID
     * directly with Google before
     * saving.
     */
    const place =
        await getGooglePlaceIdentity(
            input.placeId
        );

    return saveGoogleConnection(
        store,
        place,
        "CONFIRMED",
        input.user.id
    );
}

export async function getStoreGoogleReputation(
    storeId: string,
    userId: string,
    isSuperAdmin: boolean
) {
    const store =
        await prisma.store.findUnique({
            where: {
                id:
                    storeId,
            },

            include: {
                business: {
                    select: {
                        id: true,

                        name: true,

                        ownerId: true,
                    },
                },
            },
        });

    if (!store) {
        throw new Error(
            "STORE_NOT_FOUND"
        );
    }

    if (
        !isSuperAdmin &&
        store.business.ownerId !==
        userId
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    if (
        !store.googlePlaceId
    ) {
        return {
            connected:
                false,

            reason:
                "NOT_CONNECTED" as const,
        };
    }

    if (
        store.googlePlaceConnectedFromUrl !==
        store.googleReviewUrl
    ) {
        return {
            connected:
                false,

            reason:
                "RECONNECT_REQUIRED" as const,
        };
    }

    const place =
        await getGooglePlaceDetails(
            store.googlePlaceId
        );

    return {
        connected:
            true,

        reason:
            null,

        placeId:
            store.googlePlaceId,

        businessName:
            place.displayName
                ?.text ??
            store.name,

        address:
            place.formattedAddress ??
            store.address,

        rating:
            place.rating ??
            null,

        reviewCount:
            place.userRatingCount ??
            0,

        googleMapsUrl:
            place.googleMapsUri ??
            null,

        reviews:
            (
                place.reviews ??
                []
            ).map(
                (
                    review
                ) => ({
                    id:
                        review.name,

                    rating:
                        review.rating,

                    text:
                        review.text
                            ?.text ??
                        "",

                    originalText:
                        review.originalText
                            ?.text ??
                        null,

                    author: {
                        name:
                            review
                                .authorAttribution
                                ?.displayName ??
                            "Google user",

                        profileUrl:
                            review
                                .authorAttribution
                                ?.uri ??
                            null,

                        photoUrl:
                            review
                                .authorAttribution
                                ?.photoUri ??
                            null,
                    },

                    publishedAt:
                        review.publishTime,

                    relativeTime:
                        review
                            .relativePublishTimeDescription ??
                        null,

                    googleMapsUrl:
                        review.googleMapsUri ??
                        null,
                })
            ),
    };
}

export async function disconnectGooglePlace(
    storeId: string,
    user: {
        id: string;
        role:
        | "SUPER_ADMIN"
        | "BUSINESS_OWNER";
    }
) {
    const store =
        await prisma.store.findUnique({
            where: {
                id: storeId,
            },

            include: {
                business: {
                    select: {
                        id: true,
                        ownerId: true,
                    },
                },
            },
        });

    if (!store) {
        throw new Error(
            "STORE_NOT_FOUND"
        );
    }

    /*
     * Business owners may only
     * disconnect their own stores.
     */
    if (
        user.role !==
        "SUPER_ADMIN" &&
        store.business.ownerId !==
        user.id
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    const alreadyDisconnected =
  !store.googlePlaceId &&
  !store.googlePlaceConnectedFromUrl &&
  !store.googlePlaceConnectedAt;

  const updatedStore =
  await prisma
    .$transaction(
      async (
        tx
      ) => {
        const updated =
          await tx.store
            .update({
              where: {
                id:
                  store.id,
              },

              data: {
                googlePlaceId:
                  null,

                googlePlaceConnectedFromUrl:
                  null,

                googlePlaceConnectedAt:
                  null,
              },
            });

        await tx.auditEvent
          .create({
            data: {
              actorId:
                user.id,

              operation:
                "GOOGLE_DISCONNECT",

              target:
                store.id,

              details: {
                previousPlaceId:
                  store.googlePlaceId,
              },
            },
          });

        return updated;
      }
    );

return {
  alreadyDisconnected,

  store: {
    id:
      updatedStore.id,

    name:
      updatedStore.name,

    googleReviewUrl:
      updatedStore.googleReviewUrl,

    googlePlaceId:
      updatedStore.googlePlaceId,

    googlePlaceConnectedFromUrl:
      updatedStore.googlePlaceConnectedFromUrl,

    googlePlaceConnectedAt:
      updatedStore.googlePlaceConnectedAt,
  },
};

}

const inFlightDetails =
  new Map<
    string,
    Promise<GooglePlaceDetails>
  >();

export function getGooglePlaceDetails(
  placeId:
    string
): Promise<GooglePlaceDetails> {
  const existing =
    inFlightDetails.get(
      placeId
    );

  if (
    existing
  ) {
    return existing;
  }

  const request =
    fetchGooglePlaceDetails(
      placeId
    ).finally(
      () => {
        inFlightDetails.delete(
          placeId
        );
      }
    );

  inFlightDetails.set(
    placeId,
    request
  );

  return request;
}