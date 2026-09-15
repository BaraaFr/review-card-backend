import {
    Queue,
} from "bullmq";
import { createRedisConnection } from "../../../lib/redis.js";


export const SUBSCRIPTION_REMINDER_QUEUE =
    "valyou-subscription-reminders";

export type SubscriptionReminderJobData = {
    subscriptionId:
    string;

    expiresAt:
    string;
};

const queueConnection =
    createRedisConnection();

export const subscriptionReminderQueue =
    new Queue<SubscriptionReminderJobData>(
        SUBSCRIPTION_REMINDER_QUEUE,
        {
            connection:
                queueConnection,
        }
    );

export async function enqueueSubscriptionReminder(
    subscriptionId:
        string,

    expiresAt:
        Date
) {
    const expiresAtIso =
        expiresAt.toISOString();

    await subscriptionReminderQueue.add(
        "send-subscription-expiry-reminder",

        {
            subscriptionId,

            expiresAt:
                expiresAtIso,
        },

        {
            /*
             * Deterministic job ID:
             *
             * same subscription +
             * same expiration date
             *
             * should not intentionally create
             * multiple jobs.
             */
            jobId:
                `subscription-expiry-${subscriptionId}-${expiresAt.getTime()}`,

            attempts:
                3,

            backoff: {
                type:
                    "exponential",

                delay:
                    30_000,
            },

            removeOnComplete:
                1000,

            removeOnFail:
                1000,
        }
    );
}