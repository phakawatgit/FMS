const admin = require("firebase-admin");

let app;

function getFirebaseAdmin() {
  if (app) return app;
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (process.env.NODE_ENV === 'production') throw new Error('Auth emulator must not run in production');
    app = admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-fms' });
    return app;
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase Admin credentials are not configured");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

function getFirebaseAuth() {
  return getFirebaseAdmin() && admin.auth();
}

module.exports = { getFirebaseAuth };
