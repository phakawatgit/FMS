const { getFirebaseAuth } = require("../lib/firebase-admin");
const prisma = require("../lib/prisma");

const SESSION_COOKIE = "fms_session";
const CSRF_COOKIE = "fms_csrf";
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

async function restoreProfileFromDutyShift(user) {
  if (user.firstName) return user;
  const profile = await prisma.dutyShift.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { firstName: true, lastName: true, nickname: true },
  });
  if (!profile) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      nickname: profile.nickname,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
    },
  });
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const prefix = `${name}=`;
  const item = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function csrfForSession(sessionCookie) {
  return require("node:crypto").createHmac("sha256", sessionCookie).update("fms-csrf").digest("hex");
}

function appendSetCookie(res, value) {
  const previous = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", previous ? [].concat(previous, value) : value);
}

function cookieOptions(maxAge) {
  return ["Path=/", "SameSite=Strict", `Max-Age=${Math.floor(maxAge / 1000)}`, process.env.NODE_ENV === "production" ? "Secure" : ""].filter(Boolean).join("; ");
}

function setSessionCookies(res, sessionCookie) {
  const csrf = csrfForSession(sessionCookie);
  appendSetCookie(res, `${SESSION_COOKIE}=${encodeURIComponent(sessionCookie)}; ${cookieOptions(SESSION_MAX_AGE_MS)}; HttpOnly`);
  appendSetCookie(res, `${CSRF_COOKIE}=${csrf}; ${cookieOptions(SESSION_MAX_AGE_MS)}`);
  return csrf;
}

function clearSessionCookies(res) {
  appendSetCookie(res, `${SESSION_COOKIE}=; ${cookieOptions(0)}; HttpOnly`);
  appendSetCookie(res, `${CSRF_COOKIE}=; ${cookieOptions(0)}`);
}

async function upsertFirebaseUser(firebaseUser) {
  const email = String(firebaseUser.email || "").trim().toLowerCase();
  if (!email || !firebaseUser.emailVerified) {
    const error = new Error("A verified email address is required");
    error.status = 403;
    throw error;
  }

  const adminEmails = new Set(String(process.env.FMS_ADMIN_EMAILS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  // The environment list initializes new accounts; saved admin role changes are authoritative afterward.
  const isConfiguredAdmin = adminEmails.has(email);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ firebaseUid: firebaseUser.uid }, { email }] },
  });

  if (existing && existing.firebaseUid && existing.firebaseUid !== firebaseUser.uid) {
    const error = new Error("This account is already linked to another Firebase identity");
    error.status = 409;
    throw error;
  }

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        firebaseUid: firebaseUser.uid,
        name: firebaseUser.displayName || existing.name,
      },
    });
    return restoreProfileFromDutyShift(user);
  }

  const user = await prisma.user.create({
    data: {
      firebaseUid: firebaseUser.uid,
      email,
      name: firebaseUser.displayName || email,
      role: isConfiguredAdmin ? "ADMIN" : "VISITOR",
      isActive: true,
    },
  });
  return restoreProfileFromDutyShift(user);
}

async function requireFirebaseSession(req, res, next) {
  const sessionCookie = cookieValue(req, SESSION_COOKIE);
  if (!sessionCookie) return res.status(401).json({ success: false, message: "Authentication required" });

  try {
    const claims = await getFirebaseAuth().verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({ where: { firebaseUid: claims.uid } });
    if (!user || !user.isActive) return res.status(403).json({ success: false, message: "Account is not active" });
    req.auth = { uid: claims.uid, email: claims.email, role: user.role, userId: user.id };
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Session is invalid or expired" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ success: false, message: "Insufficient permission" });
    return next();
  };
}

function requireCsrfForUnsafeMethods(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const csrfCookie = cookieValue(req, CSRF_COOKIE);
  const sessionCookie = cookieValue(req, SESSION_COOKIE);
  const headerToken = String(req.get("X-FMS-CSRF") || "");
  const expected = sessionCookie ? csrfForSession(sessionCookie) : "";
  const crypto = require("node:crypto");
  const matches = (left, right) => left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  if (!csrfCookie || !matches(csrfCookie, expected) || !matches(headerToken, expected)) {
    return res.status(403).json({ success: false, message: "CSRF validation failed" });
  }
  return next();
}

module.exports = {
  SESSION_MAX_AGE_MS,
  clearSessionCookies,
  requireCsrfForUnsafeMethods,
  requireFirebaseSession,
  requireRole,
  setSessionCookies,
  upsertFirebaseUser,
};
