import type {
    Response,
} from "express";

import {
    createAuthSession,
} from "./auth-session.service.js";

import {
    setAuthCookies,
} from "../../utils/auth-cookie.js";

import {
    signToken,
} from "../../utils/jwt.js";

type SessionUser = {
    id: string;

    email: string;

    role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
};

export async function establishSession(
    res: Response,
    user: SessionUser,
    userAgent?:
        | string
        | null
) {
    /*
     * Create the persistent
     * server-side session first.
     */
    const session =
        await createAuthSession(
            user.id,
            userAgent
        );

    /*
     * Access JWT knows which
     * session issued it.
     */
    const accessToken =
        signToken({
            userId:
                user.id,

            email:
                user.email,

            role:
                user.role,

            sessionId:
                session.sessionId,
        });

    setAuthCookies(
        res,

        accessToken,

        session.refreshToken,

        session.expiresAt
    );

    return {
        sessionId:
            session.sessionId,

        refreshExpiresAt:
            session.expiresAt,
    };
}