import {
    randomUUID,
  } from "node:crypto";
  
  import type {
    RequestHandler,
  } from "express";
  
  import {
    logInfo,
    logWarn,
  } from "../lib/logger.js";
  
  const SAFE_REQUEST_ID =
    /^[A-Za-z0-9._:-]{8,128}$/;
  
  function getRequestId(
    value:
      string |
      undefined
  ) {
    if (
      value &&
      SAFE_REQUEST_ID.test(
        value
      )
    ) {
      return value;
    }
  
    return randomUUID();
  }
  
  export const requestObservability:
    RequestHandler =
    (
      req,
      res,
      next
    ) => {
      const requestId =
        getRequestId(
          req.get(
            "x-request-id"
          )
        );
  
      req.requestId =
        requestId;
  
      res.setHeader(
        "X-Request-Id",
        requestId
      );
  
      const startedAt =
        process.hrtime
          .bigint();
  
      res.once(
        "finish",
  
        () => {
          const durationMs =
            Number(
              process.hrtime
                .bigint() -
                startedAt
            ) /
            1_000_000;
  
          const path =
            req.originalUrl
              ?.split(
                "?"
              )[0] ??
            req.path;
  
          /*
           * Don't pollute logs with successful
           * health probes every few seconds.
           */
          if (
            res.statusCode <
              500 &&
            (
              path ===
                "/api/health" ||
              path ===
                "/api/ready"
            )
          ) {
            return;
          }
  
          const context = {
            requestId,
  
            method:
              req.method,
  
            path,
  
            statusCode:
              res.statusCode,
  
            durationMs:
              Number(
                durationMs
                  .toFixed(
                    1
                  )
              ),
  
            actorId:
              req.user
                ?.id ??
              null,
          };
  
          if (
            res.statusCode >=
            500
          ) {
            logWarn(
              "http_request",
              context
            );
  
            return;
          }
  
          logInfo(
            "http_request",
            context
          );
        }
      );
  
      next();
    };