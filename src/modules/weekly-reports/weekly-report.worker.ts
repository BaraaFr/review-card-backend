import {
    Worker,
  } from "bullmq";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  import {
    createRedisConnection,
  } from "../../lib/redis.js";
  
  import {
    getBusinessWeeklyReport,
  } from "./business-weekly-report.service.js";
  
  import {
    buildWeeklyReportEmail,
  } from "./weekly-report-email.template.js";
  
  import {
    WEEKLY_REPORT_QUEUE,
    type WeeklyReportJobData,
  } from "./weekly-report.queue.js";
import { sendEmailOnce } from "../../lib/send-email-once.js";
  
  let worker:
    Worker<WeeklyReportJobData> |
    null =
    null;
  
  export function startWeeklyReportWorker() {
    if (worker) {
      return worker;
    }
  
    worker =
      new Worker<WeeklyReportJobData>(
        WEEKLY_REPORT_QUEUE,
  
        async (
          job
        ) => {
          const {
            deliveryId,
          } =
            job.data;
  
          const delivery =
            await prisma
              .weeklyReportDelivery
              .findUnique({
                where: {
                  id:
                    deliveryId,
                },
  
                include: {
                  business: {
                    select: {
                      id:
                        true,
  
                      name:
                        true,
  
                      weeklyReportTimeZone:
                        true,
                    },
                  },
                },
              });
  
          if (!delivery) {
            throw new Error(
              "WEEKLY_REPORT_DELIVERY_NOT_FOUND"
            );
          }
          
          if (
            delivery.status ===
              "SENT" ||
            delivery.status ===
              "SKIPPED"
          ) {
            return;
          }
  
          await prisma
            .weeklyReportDelivery
            .update({
              where: {
                id:
                  delivery.id,
              },
  
              data: {
                status:
                  "PROCESSING",
  
                startedAt:
                  new Date(),
  
                error:
                  null,
              },
            });
  
          try {
            const report =
              await getBusinessWeeklyReport(
                delivery.businessId,
                delivery
                  .business
                  .weeklyReportTimeZone
              );
  
            const email =
              buildWeeklyReportEmail(
                report
              );
  
              await sendEmailOnce(
                `weekly-report:${delivery.id}`,
              
                {
                  to:
                    delivery.recipient,
              
                  subject:
                    email.subject,
              
                  html:
                    email.html,
              
                  text:
                    email.text,
              
                  messageId:
                    `<weekly-${delivery.id}@valyou>`,
                }
              );
  
            const sentAt =
              new Date();
  
            await prisma.$transaction([
              prisma
                .weeklyReportDelivery
                .update({
                  where: {
                    id:
                      delivery.id,
                  },
  
                  data: {
                    status:
                      "SENT",
  
                    sentAt,
  
                    failedAt:
                      null,
  
                    error:
                      null,
                  },
                }),
  
              /*
               * A test report should not change
               * the "last automatic report" value.
               */
              ...(delivery.kind ===
              "WEEKLY"
                ? [
                    prisma.business.update({
                      where: {
                        id:
                          delivery.businessId,
                      },
  
                      data: {
                        weeklyReportLastSentAt:
                          sentAt,
                      },
                    }),
                  ]
                : []),
            ]);
  
            return;
          } catch (error) {
            const message =
              error instanceof
              Error
                ? error.message
                : "Unknown email error";
  
            await prisma
              .weeklyReportDelivery
              .update({
                where: {
                  id:
                    delivery.id,
                },
  
                data: {
                  status:
                    "FAILED",
  
                  failedAt:
                    new Date(),
  
                  error:
                    message.slice(
                      0,
                      2000
                    ),
                },
              });
  
            throw error;
          }
        },
  
        {
          connection:
            createRedisConnection(),
  
          concurrency:
            3,
        }
      );
  
    worker.on(
      "failed",
      (
        job,
        error
      ) => {
        console.error(
          "Weekly report job failed",
          {
            jobId:
              job?.id,
  
            error,
          }
        );
      }
    );
  
    worker.on(
      "completed",
      (
        job
      ) => {
        console.log(
          "Weekly report sent",
          {
            jobId:
              job.id,
          }
        );
      }
    );
  
    return worker;
  }

  export async function stopWeeklyReportWorker() {
    if (
      !worker
    ) {
      return;
    }
  
    const current =
      worker;
  
    worker =
      null;
  
    await current.close();
  }