const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

test(
  "successful email is never sent twice",

  async () => {
    let row =
      null;

    let sends =
      0;

    const prisma = {
      emailDispatch: {
        create:
          async (
            {
              data,
            }
          ) => {
            if (
              row
            ) {
              const error =
                new Error(
                  "unique"
                );

              error.code =
                "P2002";

              throw error;
            }

            row = {
              id:
                "dispatch-1",

              ...data,

              sentAt:
                null,

              uncertainAt:
                null,

              error:
                null,
            };

            return row;
          },

        findUnique:
          async () =>
            row,

        update:
          async (
            {
              data,
            }
          ) => {
            Object.assign(
              row,
              data
            );

            return row;
          },
      },
    };

    const {
      sendEmailOnce,
    } =
      loadModule(
        "src/lib/send-email-once.ts",

        {
          "./prisma.js": {
            prisma,
          },

          "./mailer.js": {
            sendEmail:
              async () => {
                sends++;
              },
          },
        }
      );

    const email = {
      to:
        "customer@example.com",

      subject:
        "Weekly report",

      html:
        "<p>Report</p>",

      text:
        "Report",

      messageId:
        "<report@example.com>",
    };

    const first =
      await sendEmailOnce(
        "weekly-report:1",
        email
      );

    assert.equal(
      first.alreadySent,
      false
    );

    assert.equal(
      sends,
      1
    );

    assert.equal(
      row.status,
      "SENT"
    );

    const second =
      await sendEmailOnce(
        "weekly-report:1",
        email
      );

    assert.equal(
      second.alreadySent,
      true
    );

    /*
     * Critical assertion.
     */
    assert.equal(
      sends,
      1
    );
  }
);
test(
    "uncertain SMTP result is never automatically resent",
  
    async () => {
      let row =
        null;
  
      let sends =
        0;
  
      const prisma = {
        emailDispatch: {
          create:
            async (
              {
                data,
              }
            ) => {
              if (
                row
              ) {
                const error =
                  new Error(
                    "unique"
                  );
  
                error.code =
                  "P2002";
  
                throw error;
              }
  
              row = {
                id:
                  "dispatch-1",
  
                ...data,
  
                sentAt:
                  null,
  
                uncertainAt:
                  null,
  
                error:
                  null,
              };
  
              return row;
            },
  
          findUnique:
            async () =>
              row,
  
          update:
            async (
              {
                data,
              }
            ) => {
              Object.assign(
                row,
                data
              );
  
              return row;
            },
        },
      };
  
      const {
        sendEmailOnce,
      } =
        loadModule(
          "src/lib/send-email-once.ts",
  
          {
            "./prisma.js": {
              prisma,
            },
  
            "./mailer.js": {
              sendEmail:
                async () => {
                  sends++;
  
                  throw new Error(
                    "SMTP connection dropped"
                  );
                },
            },
          }
        );
  
      const email = {
        to:
          "customer@example.com",
  
        subject:
          "Report",
  
        html:
          "<p>Report</p>",
      };
  
      await assert.rejects(
        sendEmailOnce(
          "weekly-report:1",
          email
        ),
  
        /EMAIL_DELIVERY_UNCERTAIN/
      );
  
      assert.equal(
        sends,
        1
      );
  
      assert.equal(
        row.status,
        "UNKNOWN"
      );
  
      /*
       * BullMQ retry simulation.
       */
      await assert.rejects(
        sendEmailOnce(
          "weekly-report:1",
          email
        ),
  
        /EMAIL_DELIVERY_UNCERTAIN/
      );
  
      /*
       * Absolutely critical:
       *
       * SMTP was NOT called again.
       */
      assert.equal(
        sends,
        1
      );
    }
  );