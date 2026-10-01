import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: error.issues.map(({ path, message, code }) => ({
        path: path.join("."),
        message,
        code,
      })),
    });
    return;
  }

  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    response.status(400).json({
      error: "Request body contains invalid JSON.",
      code: "INVALID_JSON",
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = {
      P2002: { status: 409, message: "A record with these values already exists." },
      P2025: { status: 404, message: "The requested record was not found." },
      P2003: { status: 400, message: "The request references an invalid related record." },
    }[error.code];

    if (mapped) {
      response.status(mapped.status).json({
        error: mapped.message,
        code: error.code,
        details: error.meta,
      });
      return;
    }
  }

  console.error("Unhandled API error:", error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  response.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : message,
    code: "INTERNAL_ERROR",
  });
};
