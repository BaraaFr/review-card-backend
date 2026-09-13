import type {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    z,
} from "zod";

import {
    isValidTimeZone,
} from "./weekly-report-time.util.js";

import {
    getWeeklyReportSettings,
    sendTestWeeklyReport,
    updateWeeklyReportSettings,
} from "./weekly-report.settings.js";

const reportDaySchema =
    z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
    ]);

const settingsSchema =
    z.object({
        enabled:
            z.boolean()
                .optional(),

        day:
            reportDaySchema
                .optional(),

        time:
            z.string()
                .regex(
                    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
                    "Time must be HH:mm"
                )
                .optional(),

        timeZone:
            z.string()
                .refine(
                    (
                        value
                    ) =>
                        isValidTimeZone(
                            value
                        ),
                    "Invalid timezone"
                )
                .optional(),

        email:
            z.string()
                .email()
                .nullable()
                .optional(),
    });

export async function getWeeklyReportSettingsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Authentication required.",
                });
        }

        const {
            businessId,
        } =
            req.params;

        const data =
            await getWeeklyReportSettings(
                businessId as string,
                req.user
            );

        return res.json({
            success:
                true,

            data,
        });
    } catch (error) {
        if (
            error instanceof
            Error &&
            error.message ===
            "BUSINESS_NOT_FOUND"
        ) {
            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Business not found.",
                });
        }

        next(
            error
        );
    }
}

export async function updateWeeklyReportSettingsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Authentication required.",
                });
        }

        const parsed =
            settingsSchema.safeParse(
                req.body
            );

        if (
            !parsed.success
        ) {
            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Invalid weekly report settings.",

                    errors:
                        parsed.error.flatten(),
                });
        }

        const data =
            await updateWeeklyReportSettings(
                req.params
                    .businessId as string,
                req.user,
                parsed.data
            );

        return res.json({
            success:
                true,

            data,
        });
    } catch (error) {
        if (
            error instanceof
            Error &&
            error.message ===
            "BUSINESS_NOT_FOUND"
        ) {
            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Business not found.",
                });
        }

        next(
            error
        );
    }
}

export async function sendTestWeeklyReportController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Authentication required.",
                });
        }

        const data =
            await sendTestWeeklyReport(
                req.params
                    .businessId as string,
                req.user
            );

        return res
            .status(202)
            .json({
                success:
                    true,

                data,
            });
    } catch (error) {
        if (
            error instanceof
            Error
        ) {
            if (
                error.message ===
                "BUSINESS_NOT_FOUND"
            ) {
                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Business not found.",
                    });
            }

            if (
                error.message ===
                "SUBSCRIPTION_REQUIRED"
            ) {
                return res
                    .status(403)
                    .json({
                        success:
                            false,

                        message:
                            "An active subscription is required.",
                    });
            }

            if (
                error.message ===
                "REPORT_EMAIL_REQUIRED"
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "A report email address is required.",
                    });
            }
        }

        next(
            error
        );
    }
}