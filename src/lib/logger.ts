type LogLevel =
  | "INFO"
  | "WARN"
  | "ERROR";

type LogContext =
  Record<
    string,
    unknown
  >;

const SENSITIVE_KEYS =
  /password|secret|token|authorization|cookie|api[-_]?key/i;

const SENSITIVE_ENV_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "ANALYTICS_SALT",
  "SMTP_PASS",
  "GOOGLE_PLACES_API_KEY",
];

function redactString(
  value: string
) {
  let result =
    value;

  for (
    const key
    of SENSITIVE_ENV_KEYS
  ) {
    const secret =
      process.env[
        key
      ];

    if (
      secret &&
      secret.length >=
        4
    ) {
      result =
        result
          .split(
            secret
          )
          .join(
            "[REDACTED]"
          );
    }
  }

  result =
    result.replace(
      /Bearer\s+[^\s]+/gi,
      "Bearer [REDACTED]"
    );

  /*
   * Avoid giant log lines.
   */
  return result.slice(
    0,
    10_000
  );
}

function sanitize(
  value:
    unknown,

  depth =
    0
): unknown {
  if (
    depth >
    5
  ) {
    return "[TRUNCATED]";
  }

  if (
    value ===
      null ||
    value ===
      undefined ||
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    return redactString(
      value
    );
  }

  if (
    value instanceof
    Date
  ) {
    return value
      .toISOString();
  }

  if (
    value instanceof
    Error
  ) {
    return {
      name:
        value.name,

      message:
        redactString(
          value.message
        ),

      stack:
        value.stack
          ? redactString(
              value.stack
            )
              .split(
                "\n"
              )
              .slice(
                0,
                20
              )
              .join(
                "\n"
              )
          : undefined,
    };
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .slice(
        0,
        50
      )
      .map(
        (
          item
        ) =>
          sanitize(
            item,
            depth +
              1
          )
      );
  }

  if (
    typeof value ===
      "object"
  ) {
    const result:
      Record<
        string,
        unknown
      > =
      {};

    for (
      const [
        key,
        item,
      ]
      of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
        .slice(
          0,
          50
        )
    ) {
      if (
        SENSITIVE_KEYS
          .test(
            key
          )
      ) {
        result[
          key
        ] =
          "[REDACTED]";

        continue;
      }

      result[
        key
      ] =
        sanitize(
          item,
          depth +
            1
        );
    }

    return result;
  }

  return String(
    value
  );
}

function write(
  level:
    LogLevel,

  event:
    string,

  context:
    LogContext = {}
) {
  const payload = {
    timestamp:
      new Date()
        .toISOString(),

    level,

    event,

    ...(
      sanitize(
        context
      ) as LogContext
    ),
  };

  const line =
    JSON.stringify(
      payload
    );

  switch (
    level
  ) {
    case "ERROR":
      console.error(
        line
      );

      break;

    case "WARN":
      console.warn(
        line
      );

      break;

    default:
      console.log(
        line
      );
  }
}

export function logInfo(
  event:
    string,

  context:
    LogContext = {}
) {
  write(
    "INFO",
    event,
    context
  );
}

export function logWarn(
  event:
    string,

  context:
    LogContext = {}
) {
  write(
    "WARN",
    event,
    context
  );
}

export function logError(
  event:
    string,

  error:
    unknown,

  context:
    LogContext = {}
) {
  write(
    "ERROR",
    event,

    {
      ...context,

      error:
        sanitize(
          error
        ),
    }
  );
}