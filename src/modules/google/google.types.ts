export type GoogleLocalizedText = {
  text: string;
  languageCode?: string;
};

export type GoogleAuthorAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

export type GoogleReview = {
  name: string;

  rating: number;

  text?: GoogleLocalizedText;

  originalText?: GoogleLocalizedText;

  relativePublishTimeDescription?: string;

  publishTime: string;

  googleMapsUri?: string;

  authorAttribution?: GoogleAuthorAttribution;
};

export type GooglePlaceDetails = {
  id: string;

  displayName?: GoogleLocalizedText;

  formattedAddress?: string;

  rating?: number;

  userRatingCount?: number;

  googleMapsUri?: string;

  reviews?: GoogleReview[];
};

export type GooglePlaceSearchResult = {
  id: string;

  displayName?: GoogleLocalizedText;

  formattedAddress?: string;
};

export type GooglePlacesSearchResponse = {
  places?: GooglePlaceSearchResult[];
};

export type GoogleConnectionCandidate = {
  placeId: string;

  name: string;

  address: string | null;
};

export type GoogleConnectedResult = {
  status: "CONNECTED";

  connectionMode:
    | "EXACT_URL"
    | "CONFIRMED";

  store: {
    id: string;

    name: string;

    googleReviewUrl: string | null;

    googlePlaceId: string | null;

    googlePlaceConnectedFromUrl:
      | string
      | null;

    googlePlaceConnectedAt:
      | Date
      | null;
  };

  googlePlace: {
    id: string;

    name: string | null;

    address: string | null;
  };
};

export type GoogleConfirmationRequiredResult = {
  status: "CONFIRMATION_REQUIRED";

  confirmationToken: string;

  candidates: GoogleConnectionCandidate[];
};

export type GoogleNotFoundResult = {
  status: "NOT_FOUND";
};

export type GoogleConnectResult =
  | GoogleConnectedResult
  | GoogleConfirmationRequiredResult
  | GoogleNotFoundResult;