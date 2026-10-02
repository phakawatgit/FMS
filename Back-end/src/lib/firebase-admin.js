const admin = require("firebase-admin");
const fs = require("node:fs");

let app;

function getFirebaseAdmin() {
  if (app) return app;
  const { FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  let serviceAccount;

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
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
