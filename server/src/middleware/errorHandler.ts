import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: "Validation failed", code: "validation_error", details: err.flatten() },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code } });
    return;
  }

  // express.json() (body-parser under the hood) throws plain errors for a
  // malformed request body — a SyntaxError with .status = 400 for invalid
  // JSON, or a PayloadTooLargeError with .status = 413 for a body over the
  // size limit — neither of which is a ZodError or HttpError. Without this,
  // routine bad input (a truncated request, a paste that blew past the
  // size cap) fell through to the generic 500 branch below: the wrong
  // status for a client-caused error, and it spammed the server log with a
  // stack trace for something that isn't a server bug.
  if (err && typeof err === "object" && "status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500) {
    const message = err instanceof Error ? err.message : "Bad request";
    res.status(err.status).json({ error: { message, code: "bad_request" } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal server error", code: "internal_error" } });
}
