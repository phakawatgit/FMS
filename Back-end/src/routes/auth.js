const express = require("express");
const prisma = require("../lib/prisma");
const { getFirebaseAuth } = require("../lib/firebase-admin");
const {
  clearSessionCookies,
  requireCsrfForUnsafeMethods,
  requireFirebaseSession,
  SESSION_MAX_AGE_MS,
  setSessionCookies,
  upsertFirebaseUser,
} = require("../middleware/firebase-session");

const router = express.Router();

router.post("/session", async (req, res) => {
  const authorization = String(req.get("Authorization") || "");
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!idToken) return res.status(401).json({ success: false, message: "Firebase ID token is required" });

  try {
    const firebaseAuth = getFirebaseAuth();
    const claims = await firebaseAuth.verifyIdToken(idToken, true);
    const firebaseUser = await firebaseAuth.getUser(claims.uid);
    const user = await upsertFirebaseUser(firebaseUser);
    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    const csrfToken = setSessionCookies(res, sessionCookie);
    return res.json({
      success: true,
      data: { user: { id: user.id, uid: firebaseUser.uid, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName, nickname: user.nickname, role: user.role }, csrfToken },
    });
  } catch (error) {
    console.error("Firebase session creation failed:", error.message);
    return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "Could not establish a secure session" });
  }
});

router.get("/session", requireFirebaseSession, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true, role: true } });
    return res.json({ success: true, data: { user } });
  } catch (error) {
    console.error("Firebase session profile lookup failed:", error.message);
    return res.status(503).json({ success: false, message: "Could not load account profile" });
  }
});

router.post("/session/logout", requireCsrfForUnsafeMethods, (_req, res) => {
  clearSessionCookies(res);
  return res.json({ success: true });
});
module.exports = router;
