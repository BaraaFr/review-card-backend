import {
    z,
  } from "zod";
  
  export const confirmGooglePlaceSchema =
    z.object({
      placeId: z
        .string()
        .trim()
        .min(1),
  
      confirmationToken:
        z
          .string()
          .trim()
          .min(1),
    });