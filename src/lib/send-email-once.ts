import {
    prisma,
  } from "./prisma.js";
  
  import {
    sendEmail,
    type SendEmailInput,
  } from "./mailer.js";
  
  function isUniqueViolation(
    error:
      unknown
  ) {
    return (
      typeof error ===
        "object" &&
      error !==
        null &&
      "code" in
        error &&
      (
        error as {
          code?:
            string;
        }
      ).code ===
        "P2002"
    );
  }
  
  function getErrorMessage(
    error:
      unknown
  ) {
    if (
      error instanceof
        Error
    ) {
      return error.message
        .slice(
          0,
          2000
        );
    }
  
    return "Unknown email delivery error";
  }
  
  export async function sendEmailOnce(
    dispatchKey:
      string,
  
    input:
      SendEmailInput
  ) {
    /*
     * =====================================================
     * Reserve delivery
     * =====================================================
     *
     * This unique database row is our protection against:
     *
     * - BullMQ retry
     * - worker restart
     * - concurrent workers
     * - DB failure after SMTP succeeds
     */
  
    let dispatch;
  
    try {
      dispatch =
        await prisma.emailDispatch.create({
          data: {
            dispatchKey,
  
            recipient:
              input.to,
  
            subject:
              input.subject,
  
            messageId:
              input.messageId ??
              null,
  
            status:
              "PROCESSING",
          },
        });
    } catch (
      error
    ) {
      if (
        !isUniqueViolation(
          error
        )
      ) {
        throw error;
      }
  
      /*
       * Another attempt already owns this
       * dispatch key.
       */
  
      const existing =
        await prisma.emailDispatch
          .findUnique({
            where: {
              dispatchKey,
            },
          });
  
      if (
        !existing
      ) {
        /*
         * Extremely unlikely race:
         *
         * unique violation happened but
         * row disappeared before read.
         */
        throw new Error(
          "EMAIL_DISPATCH_CONFLICT"
        );
      }
  
      /*
       * Email is definitely known to have
       * succeeded.
       *
       * Do not call SMTP again.
       */
      if (
        existing.status ===
        "SENT"
      ) {
        return {
          sent:
            true,
  
          alreadySent:
            true,
  
          dispatchId:
            existing.id,
  
          sentAt:
            existing.sentAt,
        };
      }
  
      /*
       * PROCESSING or UNKNOWN means:
       *
       * We cannot safely know whether SMTP
       * accepted the previous message.
       *
       * Automatic resend could duplicate it.
       */
  
      if (
        existing.status ===
        "PROCESSING"
      ) {
        await prisma.emailDispatch
          .update({
            where: {
              id:
                existing.id,
            },
  
            data: {
              status:
                "UNKNOWN",
  
              uncertainAt:
                existing.uncertainAt ??
                new Date(),
  
              error:
                existing.error ??
                "Previous email delivery did not reach a confirmed database state.",
            },
          });
      }
  
      throw new Error(
        "EMAIL_DELIVERY_UNCERTAIN"
      );
    }
  
    /*
     * =====================================================
     * SMTP send
     * =====================================================
     */
  
    try {
      await sendEmail(
        input
      );
    } catch (
      error
    ) {
      /*
       * Important:
       *
       * An SMTP exception does not always prove
       * that the remote provider rejected the email.
       *
       * For example:
       *
       * provider accepts message
       * connection drops before response
       *
       * Retrying automatically could send twice.
       */
  
      try {
        await prisma.emailDispatch
          .update({
            where: {
              id:
                dispatch.id,
            },
  
            data: {
              status:
                "UNKNOWN",
  
              uncertainAt:
                new Date(),
  
              error:
                getErrorMessage(
                  error
                ),
            },
          });
      } catch (
        updateError
      ) {
        /*
         * Do not replace the original SMTP
         * problem with the bookkeeping error.
         */
        console.error(
          "email_dispatch_unknown_update_failed",
          {
            dispatchKey,
  
            error:
              updateError,
          }
        );
      }
  
      throw new Error(
        "EMAIL_DELIVERY_UNCERTAIN"
      );
    }
  
    /*
     * =====================================================
     * SMTP confirmed success
     * =====================================================
     */
  
    const sentAt =
      new Date();
  
    /*
     * Important:
     *
     * If this DB update fails AFTER SMTP succeeded,
     * the row remains PROCESSING.
     *
     * A retry will therefore refuse to send again.
     *
     * That is intentional.
     */
    await prisma.emailDispatch
      .update({
        where: {
          id:
            dispatch.id,
        },
  
        data: {
          status:
            "SENT",
  
          sentAt,
  
          uncertainAt:
            null,
  
          error:
            null,
        },
      });
  
    return {
      sent:
        true,
  
      alreadySent:
        false,
  
      dispatchId:
        dispatch.id,
  
      sentAt,
    };
  }