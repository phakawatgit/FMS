const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

let app;

function getFirebaseAdmin() {
  if (app) return app;
  const { FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  let serviceAccount;

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.isAbsolute(FIREBASE_SERVICE_ACCOUNT_PATH)
      ? FIREBASE_SERVICE_ACCOUNT_PATH
      : path.resolve(__dirname, "../..", FIREBASE_SERVICE_ACCOUNT_PATH);
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } else if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  } else {
    throw new Error("Firebase Admin credentials are not configured");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return app;
}

function getFirebaseAuth() {
  return getFirebaseAdmin() && admin.auth();
}

module.exports = { getFirebaseAuth };
