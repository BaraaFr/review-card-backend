import type {
  Request,
  Response,
} from "express";

import {
  createAdditionalBusinessSchema,
  createCustomerSchema,
  customerParamsSchema,
} from "./customer.schema.js";

import {
  customerService,
} from "./customer.service.js";

function handleCustomerError(
  error: unknown,
  res: Response
) {
  if (!(error instanceof Error)) {
    return res.status(500).json({
      success: false,
      message:
        "Something went wrong",
    });
  }

  switch (error.message) {
    case "USER_ALREADY_EXISTS":
      return res.status(409).json({
        success: false,

        code:
          "USER_ALREADY_EXISTS",

        message:
          "A customer with this email already exists",
      });

    case "USER_NOT_FOUND":
      return res.status(404).json({
        success: false,

        code:
          "USER_NOT_FOUND",

        message:
          "Customer not found",
      });

    case "ACCOUNT_ALREADY_ACTIVE":
      return res.status(409).json({
        success: false,

        code:
          "ACCOUNT_ALREADY_ACTIVE",

        message:
          "This account has already been activated",
      });

    case "ACCOUNT_DISABLED":
      return res.status(403).json({
        success: false,

        code:
          "ACCOUNT_DISABLED",

        message:
          "This account is disabled",
      });

    default:
      console.error(
        "Customer module error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to complete customer operation",
      });
  }
}

export async function createCustomer(
  req: Request,
  res: Response
) {
  try {
    const parsed =
      createCustomerSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,

        code:
          "VALIDATION_ERROR",

        message:
          "Invalid customer data",

        errors:
          parsed.error.flatten(),
      });
    }

    const result =
      await customerService
        .createCustomer(
          parsed.data
        );

    return res.status(201).json({
      success: true,

      data: result,
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function resendActivation(
  req: Request,
  res: Response
) {
  try {
    const params =
      customerParamsSchema.safeParse(
        req.params
      );

    if (!params.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid customer ID",
      });
    }

    const result =
      await customerService
        .resendActivation(
          params.data.userId
        );

    return res.json({
      success: true,

      data: result,
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function createAdditionalBusiness(
  req: Request,
  res: Response
) {
  try {
    const params =
      customerParamsSchema.safeParse(
        req.params
      );

    const body =
      createAdditionalBusinessSchema.safeParse(
        req.body
      );

    if (
      !params.success ||
      !body.success
    ) {
      return res.status(400).json({
        success: false,

        code:
          "VALIDATION_ERROR",

        message:
          "Invalid business data",
      });
    }

    const result =
      await customerService
        .createAdditionalBusiness(
          params.data.userId,
          body.data
        );

    return res.status(201).json({
      success: true,

      data: result,
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function listCustomers(
  _req: Request,
  res: Response
) {
  try {
    const customers =
      await customerService
        .listCustomers();

    return res.json({
      success: true,

      data: {
        customers,
      },
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function getCustomer(
  req: Request,
  res: Response
) {
  try {
    const params =
      customerParamsSchema.safeParse(
        req.params
      );

    if (!params.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid customer ID",
      });
    }

    const customer =
      await customerService
        .getCustomer(
          params.data.userId
        );

    return res.json({
      success: true,

      data: {
        customer,
      },
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function disableCustomer(
  req: Request,
  res: Response
) {
  try {
    const params =
      customerParamsSchema.safeParse(
        req.params
      );

    if (!params.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid customer ID",
      });
    }

    const user =
      await customerService
        .disableCustomer(
          params.data.userId
        );

    return res.json({
      success: true,

      data: {
        user,
      },
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}

export async function enableCustomer(
  req: Request,
  res: Response
) {
  try {
    const params =
      customerParamsSchema.safeParse(
        req.params
      );

    if (!params.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid customer ID",
      });
    }

    const user =
      await customerService
        .enableCustomer(
          params.data.userId
        );

    return res.json({
      success: true,

      data: {
        user,
      },
    });
  } catch (error) {
    return handleCustomerError(
      error,
      res
    );
  }
}