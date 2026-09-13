export type ActionCenterSeverity =
    | "WARNING"
    | "SUCCESS"
    | "INFO";

export type ActionCenterEntityType =
    | "CARD"
    | "LOCATION"
    | "GOOGLE"
    | "SYSTEM";

export type ActionCenterItemType =
    | "CARD_NO_RECENT_ACTIVITY"
    | "CARD_NEVER_USED"
    | "LOCATION_DECLINING"
    | "LOCATION_NO_ACTIVITY"
    | "GOOGLE_REVIEW_URL_MISSING"
    | "GOOGLE_NOT_CONNECTED"
    | "TOP_CARD"
    | "TOP_LOCATION"
    | "ALL_HEALTHY";

export type ActionCenterItem = {
    id:
    string;

    type:
    ActionCenterItemType;

    severity:
    ActionCenterSeverity;

    entityType:
    ActionCenterEntityType;

    entityId:
    string | null;

    title:
    string;

    description:
    string;

    metric:
    {
        label:
        string;

        value:
        string;
    } | null;
};

export type CurrentUser = {
    id: string;

    role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
};



export type CardActivityStatus =
    | "ACTIVE"
    | "NO_RECENT_ACTIVITY"
    | "NEVER_USED";

export type DailyBucket = {
    date:
    string;

    label:
    string;

    weekday:
    string;

    interactions:
    number;

    visitorKeys:
    Set<string>;
};

  
export type LocationPerformanceStatus =
| "GROWING"
| "STABLE"
| "DECLINING"
| "NO_ACTIVITY"
| "NEW";


export type WeeklyReportHealth =
  | "HEALTHY"
  | "NEEDS_ATTENTION";
