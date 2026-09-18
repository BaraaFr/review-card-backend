
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PLAN_LIMITS } from "../../config/plans.js";
import { CARD_PRICE_CENTS, TRIAL_DURATION_DAYS } from "../../config/commercial.js";
import { DomainError } from "../../lib/domain-error.js";
import { lock, mutate, type MutationContext, type Tx } from "../../lib/mutation.js";
import { isSubscriptionUsable } from "../../utils/subscription.js";
import { getCardUrls } from "../../utils/card-url.js";
import type { CreateStoreInput } from "../stores/store.schema.js";
import type { AssignCardInput, CreateCardInput } from "../cards/card.schema.js";
import type { CreateAdditionalBusinessInput } from "../admin/customers/customer.schema.js";
import { deliverySchema, paidPlanSchema, subscriptionStatusSchema } from "./commercial.schema.js";
const DAY_MS =
    24 *
    60 *
    60 *
    1000;

/*
 * Commercial dates must never depend
 * on the server's local timezone.
 *
 * A 30-day trial means exactly
 * 30 × 24 hours.
 */
function addUtcDays(
    date: Date,
    days: number
) {
    return new Date(
        date.getTime() +
        days * DAY_MS
    );
}

/*
 * Adds calendar months using UTC while
 * safely clamping month-end dates.
 *
 * Examples:
 *
 * Jan 15 + 1 month -> Feb 15
 * Jan 31 + 1 month -> Feb 28/29
 *
 * The UTC time-of-day is preserved,
 * so DST on the machine cannot add
 * or remove an hour from billing.
 */
function addUtcMonths(
    date: Date,
    months: number
) {
    const result =
        new Date(date);

    const originalDay =
        result.getUTCDate();

    /*
     * Move to day 1 first so changing
     * the month cannot overflow.
     */
    result.setUTCDate(
        1
    );

    result.setUTCMonth(
        result.getUTCMonth() +
        months
    );

    /*
     * Number of days in the target
     * UTC month.
     */
    const lastDay =
        new Date(
            Date.UTC(
                result.getUTCFullYear(),
                result.getUTCMonth() +
                1,
                0
            )
        ).getUTCDate();

    result.setUTCDate(
        Math.min(
            originalDay,
            lastDay
        )
    );

    return result;
}

const current = (tx: Tx, businessId: string) => tx.subscription.findFirst({
    where: { businessId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
});
const withUrls = <T extends { code: string }>(card: T) => ({ ...card, urls: getCardUrls(card.code) });
const cardInclude = { store: { include: { business: true } } } as const;

function admin(context: MutationContext) {
    if (context.actor.role !== "SUPER_ADMIN") throw new DomainError(403, "FORBIDDEN", "Administrator access required.");
}

async function business(tx: Tx, context: MutationContext, businessId: string) {
    await lock(tx, `business:${businessId}`);
    const value = await tx.business.findFirst({
        where: {
            id: businessId,
            ...(context.actor.role === "SUPER_ADMIN" ? {} : { ownerId: context.actor.id }),
        }
    });
    if (!value) throw new DomainError(404, "BUSINESS_NOT_FOUND", "Business not found.");
    return value;
}

async function limits(tx: Tx, context: MutationContext, businessId: string) {
    const subscription = await current(tx, businessId);
    if (subscription && isSubscriptionUsable(subscription)) return PLAN_LIMITS[subscription.plan];
    if (context.actor.role === "SUPER_ADMIN") return PLAN_LIMITS.STARTER;
    throw new DomainError(403, "SUBSCRIPTION_REQUIRED", "An active subscription is required.");
}

async function checkCapacity(tx: Tx, businessId: string, plan: keyof typeof PLAN_LIMITS) {
    const stores = await tx.store.count({ where: { businessId } });
    const cards = await tx.card.count({ where: { store: { businessId }, status: { not: "UNASSIGNED" } } });
    if (stores > PLAN_LIMITS[plan].stores) throw new DomainError(409, "PLAN_STORE_LIMIT_EXCEEDED", "Too many locations for this plan.");
    if (cards > PLAN_LIMITS[plan].cards) throw new DomainError(409, "PLAN_CARD_LIMIT_EXCEEDED", "Too many cards for this plan.");
}

async function reserveReceipt(tx: Tx, reference: string) {
    await lock(tx, `receipt:${reference}`);
    if (await tx.paymentRecord.findUnique({ where: { receiptReference: reference } })) {
        throw new DomainError(409, "PAYMENT_ALREADY_RECORDED", "This receipt has already been recorded. Check payment history before entering another receipt.");
    }
}

export const commercialService = {
    createAdditionalBusiness(context: MutationContext, userId: string, input: CreateAdditionalBusinessInput) {
        admin(context);
        return mutate(context, "BUSINESS_CREATE", userId, input, async (tx) => {
            await lock(tx, `owner:${userId}`);
            const owner = await tx.user.findFirst({ where: { id: userId, role: "BUSINESS_OWNER" } });
            if (!owner) throw new DomainError(404, "USER_NOT_FOUND", "Customer not found.");
            const business = await tx.business.create({ data: { ownerId: userId, name: input.name, logoUrl: input.logoUrl ?? null } });
            const store = await tx.store.create({
                data: {
                    businessId: business.id, name: input.location.name,
                    address: input.location.address ?? null, googleReviewUrl: input.location.googleReviewUrl,
                }
            });
            return { business, store, subscription: null };
        });
    },

    createStore(context: MutationContext, businessId: string, input: CreateStoreInput) {
        return mutate(context, "STORE_CREATE", businessId, input, async (tx) => {
            await business(tx, context, businessId);
            const capacity = await limits(tx, context, businessId);
            const count = await tx.store.count({ where: { businessId } });
            if (count >= capacity.stores) throw new DomainError(409, "STORE_LIMIT_REACHED", "The location limit has been reached.");
            const store = await tx.store.create({
                data: {
                    businessId, name: input.name, address: input.address ?? null,
                    googleReviewUrl: input.googleReviewUrl ?? null,
                }
            });
            return { store };
        });
    },

    removeStore(context: MutationContext, storeId: string) {
        return mutate(context, "STORE_DELETE", storeId, {}, async (tx) => {
            const store = await tx.store.findUnique({ where: { id: storeId } });
            if (!store) throw new DomainError(404, "STORE_NOT_FOUND", "Location not found.");
            await business(tx, context, store.businessId);
            if (await tx.card.count({ where: { storeId } }) || await tx.interaction.count({ where: { storeId } })) {
                throw new DomainError(409, "STORE_HAS_HISTORY", "Locations with cards or scan history cannot be removed.");
            }
            await tx.store.delete({ where: { id: storeId } });
            return { deleted: true };
        });
    },

    createCard(context: MutationContext, input: CreateCardInput) {
        admin(context);
        return mutate(context, "CARD_CREATE", "inventory", input, async (tx) => ({
            card: withUrls(
                await tx.card.create({
                    data: {
                        code: randomBytes(10).toString("hex").toUpperCase(), label: input.label ?? null, status: "UNASSIGNED",
                    }
                }),
            )
        }));
    },

    assignCard(context: MutationContext, cardId: string, input: AssignCardInput) {
        admin(context);
        return mutate(context, "CARD_ASSIGN", cardId, input, async (tx) => {
            await lock(tx, `card:${cardId}`);
            const card = await tx.card.findUnique({ where: { id: cardId }, include: { store: true } });
            const store = await tx.store.findUnique({ where: { id: input.storeId } });
            if (!card) throw new DomainError(404, "CARD_NOT_FOUND", "Card not found.");
            if (!store) throw new DomainError(404, "STORE_NOT_FOUND", "Location not found.");
            for (const id of [...new Set([store.businessId, card.store?.businessId].filter((id): id is string => !!id))].sort()) {
                await business(tx, context, id);
            }
            if (!store.googleReviewUrl) throw new DomainError(409, "STORE_REVIEW_URL_REQUIRED", "Add a Google review URL first.");
            const capacity = await limits(tx, context, store.businessId);
            const count = await tx.card.count({
                where: {
                    id: { not: cardId }, store: { businessId: store.businessId }, status: { not: "UNASSIGNED" },
                }
            });
            if (count >= capacity.cards) throw new DomainError(409, "CARD_LIMIT_REACHED", "The card limit has been reached.");
            const transferred = card.store?.businessId !== store.businessId;
            const updated = await tx.card.update({
                where: { id: cardId }, data: {
                    storeId: store.id, status: "ACTIVE", label: input.label,
                    assignedAt: transferred ? new Date() : card.assignedAt ?? new Date(),
                    ...(transferred ? { paidAt: null, deliveredAt: null, salePriceCents: null, paymentMethod: null } : {}),
                }, include: cardInclude
            });
            return { card: withUrls(updated) };
        });
    },

    unassignCard(context: MutationContext, cardId: string) {
        admin(context);
        return mutate(context, "CARD_UNASSIGN", cardId, {}, async (tx) => {
            await lock(tx, `card:${cardId}`);
            const card = await tx.card.findUnique({ where: { id: cardId }, include: { store: true } });
            if (!card) throw new DomainError(404, "CARD_NOT_FOUND", "Card not found.");
            if (card.store) await business(tx, context, card.store.businessId);
            const updated = await tx.card.update({
                where: { id: cardId }, data: {
                    storeId: null, status: "UNASSIGNED", assignedAt: null,
                    paidAt: null, deliveredAt: null, salePriceCents: null, paymentMethod: null,
                }, include: cardInclude
            });
            return { card: withUrls(updated) };
        });
    },

    deliverCard(context: MutationContext, cardId: string, input: z.infer<typeof deliverySchema>) {
        admin(context);
        return mutate(context, "CARD_DELIVER", cardId, input, async (tx) => {
            await lock(tx, `card:${cardId}`);
            const card = await tx.card.findUnique({ where: { id: cardId }, include: { store: true } });
            if (!card) throw new DomainError(404, "CARD_NOT_FOUND", "Card not found.");
            if (!card.store) throw new DomainError(409, "CARD_NOT_ASSIGNED", "Assign the card before delivery.");
            await business(tx, context, card.store.businessId);
            if (card.deliveredAt || card.paidAt) throw new DomainError(409, "CARD_ALREADY_DELIVERED", "This assignment already has a payment or delivery. Review its history.");
            await reserveReceipt(tx, input.receiptReference);
            const now = new Date();
            const updated = await tx.card.update({
                where: { id: cardId }, data: {
                    paidAt: now, deliveredAt: now, salePriceCents: CARD_PRICE_CENTS, paymentMethod: input.paymentMethod,
                }, include: cardInclude
            });
            await tx.paymentRecord.create({
                data: {
                    businessId: card.store.businessId, cardId, kind: "CARD", amountCents: CARD_PRICE_CENTS,
                    currency: "USD", paymentMethod: input.paymentMethod, receiptReference: input.receiptReference,
                    actorId: context.actor.id, receivedAt: now,
                }
            });
            return { card: withUrls(updated) };
        });
    },

    startTrial(context: MutationContext, businessId: string) {
        admin(context);
        return mutate(context, "TRIAL_START", businessId, {}, async (tx) => {
            const ownerBusiness = await business(tx, context, businessId);
            if (ownerBusiness.trialStartedAt || await tx.subscription.count({ where: { businessId, status: "TRIAL" } })) {
                throw new DomainError(409, "TRIAL_ALREADY_USED", "This business has already used its trial.");
            }
            const existing = await current(tx, businessId);
            if (existing && (isSubscriptionUsable(existing) || (existing.startsAt > new Date() && ["TRIAL", "ACTIVE"].includes(existing.status)))) {
                throw new DomainError(409, "SUBSCRIPTION_ALREADY_ACTIVE", "This business already has an active or scheduled subscription.");
            }
            if (!await tx.card.count({ where: { store: { businessId }, paidAt: { not: null }, deliveredAt: { not: null } } })) {
                throw new DomainError(409, "DELIVERED_CARD_REQUIRED", "A paid and delivered card is required first.");
            }
            await checkCapacity(tx, businessId, "STARTER");
            const now = new Date();
            await tx.business.update({ where: { id: businessId }, data: { trialStartedAt: now } });
            await tx.subscription.updateMany({ where: { businessId, status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } }, data: { status: "EXPIRED" } });
            const subscription = await tx.subscription.create({
                data: {
                    businessId, plan: "STARTER", status: "TRIAL", startsAt: now, expiresAt: addUtcDays(now, TRIAL_DURATION_DAYS),
                }
            });
            return { subscription };
        });
    },

    activatePaid(context: MutationContext, businessId: string, input: z.infer<typeof paidPlanSchema>) {
        admin(context);
        return mutate(context, "SUBSCRIPTION_PAID", businessId, input, async (tx) => {
            await business(tx, context, businessId);
            await checkCapacity(tx, businessId, input.plan);
            await reserveReceipt(tx, input.receiptReference);
            const existing = await current(tx, businessId);
            const now = new Date();
            if (existing && existing.startsAt > now && ["ACTIVE", "TRIAL"].includes(existing.status)) {
                throw new DomainError(409, "SCHEDULED_SUBSCRIPTION", "Review the scheduled subscription before accepting this renewal.");
            }
            if (existing && isSubscriptionUsable(existing) && !existing.expiresAt) {
                throw new DomainError(409, "UNLIMITED_SUBSCRIPTION", "An unlimited subscription cannot be renewed by adding months.");
            }
            const usable = !!existing && isSubscriptionUsable(existing);
            const renewalBase =
                usable &&
                    existing?.expiresAt
                    ? existing.expiresAt
                    : now;

            const expiresAt =
                addUtcMonths(
                    renewalBase,
                    input.months
                );
            
                const data = {
                plan: input.plan, status: "ACTIVE" as const,
                startsAt: usable && existing ? existing.startsAt : now, expiresAt,
                expiryReminderFor: null, expiryReminderSentAt: null
            };
            const subscription = existing
                ? await tx.subscription.update({ where: { id: existing.id }, data })
                : await tx.subscription.create({ data: { businessId, ...data } });
            const payment = await tx.paymentRecord.create({
                data: {
                    businessId, subscriptionId: subscription.id, kind: "SUBSCRIPTION", amountCents: input.amountCents,
                    currency: "USD", paymentMethod: input.paymentMethod, receiptReference: input.receiptReference,
                    actorId: context.actor.id, receivedAt: now,
                    details: { plan: input.plan, months: input.months, previousExpiresAt: existing?.expiresAt?.toISOString() ?? null, expiresAt: expiresAt.toISOString() },
                }
            });
            return { subscription, payment };
        });
    },

    changeStatus(context: MutationContext, subscriptionId: string, input: z.infer<typeof subscriptionStatusSchema>) {
        admin(context);
        return mutate(context, "SUBSCRIPTION_STATUS", subscriptionId, input, async (tx) => {
            const subscription = await tx.subscription.findUnique({ where: { id: subscriptionId } });
            if (!subscription) throw new DomainError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found.");
            await business(tx, context, subscription.businessId);
            return { subscription: await tx.subscription.update({ where: { id: subscriptionId }, data: { status: input.status } }) };
        });
    },
};