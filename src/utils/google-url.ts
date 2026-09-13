export const isAllowedGoogleReviewUrl = (
    value: string
  ): boolean => {
    try {
      const url = new URL(value);
  
      if (url.protocol !== "https:") {
        return false;
      }
  
      const hostname = url.hostname.toLowerCase();
  
      return (
        hostname === "g.page" ||
        hostname === "google.com" ||
        hostname.endsWith(".google.com")
      );
    } catch {
      return false;
    }
  };