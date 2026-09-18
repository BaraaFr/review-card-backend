import {
    prisma,
  } from "./prisma.js";
  
  import {
    requestRedis,
  } from "./request-redis.js";
  
  let probe:
    Promise<boolean> |
    undefined;
  
  export async function isReady() {
    /*
     * Reuse a currently running probe
     * instead of allowing many readiness
     * requests to hammer dependencies.
     */
    probe ??=
      Promise.all([
        prisma
          .$queryRaw`
            SELECT 1
          `,
  
        requestRedis()
          .then(
            (
              client
            ) =>
              client.ping()
          ),
      ])
        .then(
          () =>
            true
        )
        .catch(
          () =>
            false
        )
        .finally(
          () => {
            probe =
              undefined;
          }
        );
  
    let timer:
      NodeJS.Timeout |
      undefined;
  
    try {
      return await Promise.race([
        probe,
  
        new Promise<boolean>(
          (
            resolve
          ) => {
            timer =
              setTimeout(
                () =>
                  resolve(
                    false
                  ),
  
                2000
              );
          }
        ),
      ]);
    } finally {
      if (
        timer
      ) {
        clearTimeout(
          timer
        );
      }
    }
  }