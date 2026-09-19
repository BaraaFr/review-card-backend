import {
    logError,
  } from "./logger.js";
  
  let installed =
    false;
  
  export function installFatalProcessHandlers(
    component:
      "api" |
      "worker"
  ) {
    if (
      installed
    ) {
      return;
    }
  
    installed =
      true;
  
    process.once(
      "uncaughtException",
  
      (
        error
      ) => {
        /*
         * The process is now considered unsafe.
         *
         * Log it and allow the production
         * process manager to restart us.
         */
        logError(
          "process_uncaught_exception",
  
          error,
  
          {
            component,
          }
        );
  
        process.exit(
          1
        );
      }
    );
  
    process.once(
      "unhandledRejection",
  
      (
        reason
      ) => {
        logError(
          "process_unhandled_rejection",
  
          reason,
  
          {
            component,
          }
        );
  
        process.exit(
          1
        );
      }
    );
  }