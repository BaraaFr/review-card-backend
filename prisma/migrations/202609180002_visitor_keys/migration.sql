UPDATE "Interaction"
SET "visitorKey" =
  'legacy:' || "visitorHash"
WHERE
  "visitorKey" IS NULL
  AND "visitorHash" IS NOT NULL;