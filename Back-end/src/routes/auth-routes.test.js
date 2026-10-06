import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const router = require("./auth.js");

function handler(method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return layer.route.stack.at(-1).handle;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe("authentication input validation", () => {
  it("requires a Firebase token to create a session", async () => {
    const res = response();
    await handler("post", "/session")({ get: () => "" }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain("token is required");
  });

  it("requires a Firebase token before requesting signup verification", async () => {
    const res = response();
    await handler("post", "/signup/otp/request")({ get: () => "" }, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects malformed signup OTP input", async () => {
    const res = response();
    await handler("post", "/signup/otp/verify")({ get: () => "Bearer token", body: { code: "123" } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("requires an email for password reset OTP requests", async () => {
    const res = response();
    await handler("post", "/password-reset/otp/request")({ body: { email: " " } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects malformed password reset OTP input", async () => {
    const res = response();
    await handler("post", "/password-reset/otp/verify")({ body: { email: "user@example.com", code: "abcdef" } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("requires an email, reset token and six-character password", async () => {
    const res = response();
    await handler("post", "/password-reset/complete")({ body: { email: "user@example.com", resetToken: "token", password: "123" } }, res);
    expect(res.statusCode).toBe(400);
  });
});
