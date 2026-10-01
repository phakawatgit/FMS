import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    deleteUser,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import "./admin-audit.js";

const authForm = document.getElementById("authForm");
const googleButton = document.getElementById("googleLogin");
const statusText = document.getElementById("loginStatus");
const languageInputs = document.querySelectorAll("input[name='language']");
const tabButtons = document.querySelectorAll(".tab-button");
const signupField = document.querySelector(".signup-field");
const authTitle = document.getElementById("auth-title");
const authKicker = document.getElementById("auth-kicker");
const authDescription = document.getElementById("auth-description");
const submitButton = document.getElementById("submitButton");
const passwordInput = document.getElementById("password");
const authOverline = document.querySelector(".auth-overline");
const systemName = document.querySelector(".auth-system-name");
const brandLabel = document.getElementById("brandLabel");
const brandKicker = document.getElementById("brandKicker");
const brandTitle = document.getElementById("brandTitle");
const brandDescription = document.getElementById("brandDescription");
const googleText = googleButton.lastChild;
const terms = document.querySelector(".terms");
const forgotButton = document.querySelector(".forgot-button");
const languageSwitcher = document.querySelector(".language-switcher");
const resetFlow = document.getElementById("resetFlow");
const resetBackButton = document.getElementById("resetBack");
const signupOtpFlow = document.getElementById("signupOtpFlow");
const signupOtpBack = document.getElementById("signupOtpBack");
const signupOtpForm = document.getElementById("signupOtpForm");
const signupOtpInput = document.getElementById("signupOtp");
const signupOtpStatus = document.getElementById("signupOtpStatus");
const signupOtpEmail = document.getElementById("signupOtpEmail");
const signupOtpResend = document.getElementById("signupOtpResend");
const resetEmailForm = document.getElementById("resetEmailForm");
const resetOtpForm = document.getElementById("resetOtpForm");
const newPasswordForm = document.getElementById("newPasswordForm");
const resetEmailInput = document.getElementById("resetEmail");
const resetOtpInput = document.getElementById("resetOtp");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const resetStatus = document.getElementById("resetStatus");
const API_BASE = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
const ADMIN_SESSION_KEY = "fms-admin-session";
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "admin12345678";

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        button.classList.toggle("is-visible", !visible);
        button.setAttribute("aria-pressed", String(!visible));
        button.setAttribute("aria-label", visible ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน");
    });
});

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD6eLRN8rU-e7KJMb1Diw_mFNH81pWpzIg",
    authDomain: "fams-7fdff.firebaseapp.com",
    projectId: "fams-7fdff",
    storageBucket: "fams-7fdff.firebasestorage.app",
    messagingSenderId: "636847349725",
    appId: "1:636847349725:web:01eaad241d971a2437a034"
};

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
// Always let the user choose the Google account instead of silently reusing
// the account remembered by the browser.
googleProvider.setCustomParameters({ prompt: "select_account" });

let currentMode = "login";
let currentLanguage = "en";
let pendingSignup = null;

const translations = {
    en: {
        language: "English",
        brandLabel: "Healthcare workspace",
        brandKicker: "First Aid & Medicine",
        brandTitle: "First Aid &<br><em>Medicine.</em>",
        brandDescription: "A simple and secure workspace for managing First Aid and Medicine information.",
        welcome: "Welcome to FMS",
        system: "First Aid & Medicine Management System",
        join: "Join the workspace",
        back: "Welcome back",
        loginTitle: "Sign in to FMS",
        signupTitle: "Create your account",
        loginDescription: "Sign in to manage your First Aid and Medicine information.",
        signupDescription: "Create an account to manage your First Aid and Medicine information.",
        fullName: "Full name",
        email: "Username or email address",
        password: "Password",
        remember: "Remember me",
        forgot: "Forgot password?",
        login: "Log in",
        signup: "Create an account",
        google: "Continue with Google",
        orContinue: "or continue with",
        continueTerms: "By continuing, you agree to the FMS workspace terms.",
        loginProgress: "Signing you in...",
        signupProgress: "Creating your account...",
        googleProgress: "Preparing Google sign-in...",
        forgotProgress: "Password reset is ready to connect to the backend.",
        resetBack: "Back to sign in",
        resetKicker: "PASSWORD RECOVERY",
        resetTitle: "Verify your email",
        resetDescription: "Enter your email to receive an OTP",
        emailAddress: "Email address",
        sendOtp: "Send OTP",
        otpLabel: "OTP code",
        otpPlaceholder: "Enter 6-digit code",
        verifyOtp: "Verify OTP",
        newPassword: "New password",
        newPasswordPlaceholder: "At least 6 characters",
        confirmPassword: "Confirm password",
        confirmPasswordPlaceholder: "Enter your password again",
        changePassword: "Change password",
        sendingOtp: "Sending OTP...",
        otpSent: "OTP sent. Please check your inbox.",
        otpSendFailed: "Could not send OTP. Please try again.",
        verifyingOtp: "Verifying OTP...",
        otpVerified: "OTP verified. Please set a new password.",
        otpInvalid: "Invalid OTP. Please try again.",
        passwordTooShort: "Password must be at least 6 characters.",
        passwordMismatch: "Passwords do not match.",
        passwordChanged: "Password changed successfully. Please sign in again.",
        passwordChangeFailed: "Could not change password. Please try again."
    },
    th: {
        language: "ไทย",
        brandLabel: "พื้นที่ทำงานด้านสุขภาพ",
        brandKicker: "ปฐมพยาบาลและยา",
        brandTitle: "ปฐมพยาบาล<br><em>และยา</em>",
        brandDescription: "ระบบจัดการปฐมพยาบาลและยา เพื่อให้การดูแลข้อมูลเป็นเรื่องง่าย เป็นระบบ และปลอดภัย",
        welcome: "ยินดีต้อนรับสู่ FMS",
        system: "ระบบจัดการปฐมพยาบาลและยา",
        join: "เข้าร่วมพื้นที่ทำงาน",
        back: "ยินดีต้อนรับกลับ",
        loginTitle: "เข้าสู่ระบบ FMS",
        signupTitle: "สร้างบัญชีของคุณ",
        loginDescription: "เข้าสู่ระบบเพื่อจัดการข้อมูลการปฐมพยาบาลและยาของคุณ",
        signupDescription: "สร้างบัญชีเพื่อเริ่มจัดการข้อมูลการปฐมพยาบาลและยา",
        fullName: "ชื่อ-นามสกุล",
        email: "ชื่อผู้ใช้หรืออีเมล",
        password: "รหัสผ่าน",
        remember: "จดจำฉัน",
        forgot: "ลืมรหัสผ่าน?",
        login: "เข้าสู่ระบบ",
        signup: "สร้างบัญชี",
        google: "เข้าสู่ระบบด้วย Google",
        orContinue: "หรือเข้าสู่ระบบด้วย",
        continueTerms: "เมื่อดำเนินการต่อ คุณยอมรับเงื่อนไขการใช้งาน FMS",
        loginProgress: "กำลังเข้าสู่ระบบ...",
        signupProgress: "กำลังสร้างบัญชี...",
        googleProgress: "กำลังเตรียมเชื่อมต่อ Google...",
        forgotProgress: "ฟังก์ชันรีเซ็ตรหัสผ่านพร้อมเชื่อมต่อ backend",
        resetBack: "กลับไปเข้าสู่ระบบ",
        resetKicker: "กู้คืนรหัสผ่าน",
        resetTitle: "ยืนยันอีเมล",
        resetDescription: "กรอกอีเมลเพื่อรับรหัส OTP",
        emailAddress: "อีเมล",
        sendOtp: "รับรหัส OTP",
        otpLabel: "รหัส OTP",
        otpPlaceholder: "กรอกรหัส 6 หลัก",
        verifyOtp: "ยืนยัน OTP",
        newPassword: "รหัสผ่านใหม่",
        newPasswordPlaceholder: "อย่างน้อย 6 ตัวอักษร",
        confirmPassword: "ยืนยันรหัสผ่าน",
        confirmPasswordPlaceholder: "กรอกรหัสผ่านอีกครั้ง",
        changePassword: "เปลี่ยนรหัสผ่าน",
        sendingOtp: "กำลังส่ง OTP...",
        otpSent: "ส่ง OTP ไปยังอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย",
        otpSendFailed: "ส่ง OTP ไม่สำเร็จ กรุณาลองใหม่",
        verifyingOtp: "กำลังตรวจสอบ OTP...",
        otpVerified: "ยืนยัน OTP สำเร็จ กรุณาตั้งรหัสผ่านใหม่",
        otpInvalid: "OTP ไม่ถูกต้อง กรุณาลองใหม่",
        passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        passwordMismatch: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน",
        passwordChanged: "เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง",
        passwordChangeFailed: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"
    }
};

function setText(element, value) {
    if (element) element.textContent = value;
}

function renderLanguage() {
    const t = translations[currentLanguage];
    const isSignup = currentMode === "signup";

    document.documentElement.lang = currentLanguage;
    document.body.classList.toggle("is-thai", currentLanguage === "th");

    setText(brandLabel, t.brandLabel);
    setText(brandKicker, t.brandKicker);
    if (brandTitle) brandTitle.innerHTML = t.brandTitle;
    setText(brandDescription, t.brandDescription);
    setText(authOverline, t.welcome);
    setText(systemName, t.system);
    setText(authKicker, isSignup ? t.join : t.back);
    setText(authTitle, isSignup ? t.signupTitle : t.loginTitle);
    setText(authDescription, isSignup ? t.signupDescription : t.loginDescription);
    setText(submitButton, isSignup ? t.signup : t.login);
    setText(googleText, ` ${t.google}`);
    setText(terms, t.continueTerms);

    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (t[key]) setText(element, t[key]);
    });

    tabButtons[0].textContent = t.login;
    tabButtons[1].textContent = t.signup;
    passwordInput.placeholder = currentLanguage === "th" ? "กรอกรหัสผ่าน" : "Enter your password";
    document.getElementById("fullName").placeholder = currentLanguage === "th" ? "ชื่อของคุณ" : "Your name";
    document.getElementById("email").placeholder = currentLanguage === "th" ? "name@example.com" : "name@example.com";

    const resetBackText = resetBackButton.querySelector("span");
    setText(resetBackText, t.resetBack);
    setText(resetFlow.querySelector(".auth-kicker"), t.resetKicker);
    setText(document.getElementById("resetTitle"), t.resetTitle);
    setText(document.getElementById("resetDescription"), t.resetDescription);
    setText(resetEmailForm.querySelector("label"), t.emailAddress);
    setText(resetEmailForm.querySelector("button[type=submit]"), t.sendOtp);
    setText(resetOtpForm.querySelector("label"), t.otpLabel);
    setText(resetOtpForm.querySelector("button[type=submit]"), t.verifyOtp);
    setText(newPasswordForm.querySelector("label"), t.newPassword);
    setText(newPasswordForm.querySelectorAll("label")[1], t.confirmPassword);
    setText(newPasswordForm.querySelector("button[type=submit]"), t.changePassword);
    resetEmailInput.placeholder = "name@example.com";
    resetOtpInput.placeholder = t.otpPlaceholder;
    newPasswordInput.placeholder = t.newPasswordPlaceholder;
    confirmPasswordInput.placeholder = t.confirmPasswordPlaceholder;
    setText(signupOtpBack.querySelector("span"), currentLanguage === "th" ? "กลับไปสร้างบัญชี" : "Back to create account");
    setText(signupOtpFlow.querySelector(".auth-kicker"), currentLanguage === "th" ? "ยืนยันอีเมล" : "EMAIL VERIFICATION");
    setText(document.getElementById("signupOtpTitle"), currentLanguage === "th" ? "ยืนยันอีเมล" : "Verify your email");
    setText(document.getElementById("signupOtpDescription"), currentLanguage === "th" ? "กรอกรหัส OTP ที่ส่งไปยังอีเมลของคุณ" : "Enter the OTP sent to your email");
    setText(signupOtpForm.querySelector("label"), currentLanguage === "th" ? "รหัส OTP" : "OTP code");
    setText(signupOtpForm.querySelector("button"), currentLanguage === "th" ? "ยืนยันอีเมล" : "Verify email");
    setText(signupOtpResend, currentLanguage === "th" ? "ส่ง OTP อีกครั้ง" : "Resend OTP");
    signupOtpInput.placeholder = currentLanguage === "th" ? "กรอกรหัส 6 หลัก" : "Enter 6-digit code";
}

function setMode(mode) {
    currentMode = mode;
    const isSignup = mode === "signup";

    tabButtons.forEach((button) => {
        const isActive = button.dataset.mode === mode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    signupField.hidden = !isSignup;
    passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
    statusText.textContent = "";
    renderLanguage();
}

tabButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
});

languageInputs.forEach((input) => {
    input.addEventListener("change", () => {
        currentLanguage = input.value;
        renderLanguage();
    });
});

languageSwitcher.addEventListener("click", (event) => {
    event.preventDefault();
    const nextLanguage = currentLanguage === "en" ? "th" : "en";
    const nextInput = document.querySelector(`input[name='language'][value='${nextLanguage}']`);
    nextInput.checked = true;
    currentLanguage = nextLanguage;
    renderLanguage();
});

authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const t = translations[currentLanguage];
    statusText.textContent = currentMode === "signup" ? t.signupProgress : t.loginProgress;
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    const fullName = document.getElementById("fullName").value.trim();
    if (currentMode === "login" && email.toLowerCase() === ADMIN_USERNAME.toLowerCase() && password === ADMIN_PASSWORD) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ username: ADMIN_USERNAME, role: "admin", signedInAt: new Date().toISOString() }));
        window.FMSAdminAudit?.log("login", { provider: "admin-demo", username: ADMIN_USERNAME });
        showSignedInMessage({ displayName: ADMIN_USERNAME, email: ADMIN_USERNAME });
        return;
    }
    // A Firebase user must never inherit the local demo-admin session.
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    if (currentMode === "signup") {
        submitButton.disabled = true;
        createUserWithEmailAndPassword(firebaseAuth, email, password)
            .then(async ({ user }) => {
                if (fullName) await updateProfile(user, { displayName: fullName });
                const response = await fetch(`${API_BASE}/api/auth/signup-otp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email || email, firebaseUid: user.uid }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "ส่ง OTP ไม่สำเร็จ");
                pendingSignup = { email: user.email || email, firebaseUid: user.uid, password, displayName: user.displayName || fullName };
                await signOut(firebaseAuth);
                authForm.hidden = true;
                document.querySelector(".divider").hidden = true;
                googleButton.hidden = true;
                terms.hidden = true;
                resetFlow.hidden = true;
                signupOtpFlow.hidden = false;
                signupOtpEmail.textContent = pendingSignup.email;
                signupOtpInput.value = "";
                signupOtpStatus.textContent = translations[currentLanguage].otpSent;
                signupOtpInput.focus();
            })
            .catch(async (error) => {
                if (firebaseAuth.currentUser && error.message !== "auth/email-already-in-use") await deleteUser(firebaseAuth.currentUser).catch(() => {});
                showFirebaseError(error);
            })
            .finally(() => { submitButton.disabled = false; });
        return;
    }
    const authTask = currentMode === "signup"
        ? createUserWithEmailAndPassword(firebaseAuth, email, password).then(async ({ user }) => {
            if (fullName) await updateProfile(user, { displayName: fullName });
            return user;
        })
        : signInWithEmailAndPassword(firebaseAuth, email, password);
    authTask.then(({ user }) => {
        window.FMSAdminAudit?.log(currentMode === "signup" ? "create-account" : "login", { provider: "email", email: user.email || email });
        showSignedInMessage(user);
    }).catch(showFirebaseError);
});

googleButton.addEventListener("click", async () => {
    statusText.textContent = translations[currentLanguage].googleProgress;
    try {
        // Google sign-in is a normal user session, not the local admin demo.
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        window.FMSAdminAudit?.log("google-login", { email: result.user.email || "" });
        showSignedInMessage(result.user);
    } catch (error) {
        showFirebaseError(error);
    }
});

let resetToken = "";

function showResetFlow() {
    window.FMSAdminAudit?.log("forgot-password-opened", { email: document.getElementById("email").value.trim() });
    authForm.hidden = true;
    document.querySelector(".divider").hidden = true;
    googleButton.hidden = true;
    terms.hidden = true;
    resetFlow.hidden = false;
    resetEmailInput.value = document.getElementById("email").value.trim();
    resetEmailInput.focus();
}

function hideResetFlow() {
    resetFlow.hidden = true;
    authForm.hidden = false;
    document.querySelector(".divider").hidden = false;
    googleButton.hidden = false;
    terms.hidden = false;
    resetEmailForm.hidden = false;
    resetOtpForm.hidden = true;
    newPasswordForm.hidden = true;
    resetStatus.textContent = "";
    resetToken = "";
}

forgotButton.addEventListener("click", showResetFlow);
resetBackButton.addEventListener("click", hideResetFlow);

signupOtpBack.addEventListener("click", () => {
    pendingSignup = null;
    signupOtpFlow.hidden = true;
    authForm.hidden = false;
    document.querySelector(".divider").hidden = false;
    googleButton.hidden = false;
    terms.hidden = false;
    setMode("signup");
});

async function resendSignupOtp() {
    if (!pendingSignup) return;
    signupOtpResend.disabled = true;
    signupOtpStatus.textContent = translations[currentLanguage].sendingOtp;
    try {
        const response = await fetch(`${API_BASE}/api/auth/signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingSignup.email, firebaseUid: pendingSignup.firebaseUid }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "ส่ง OTP ไม่สำเร็จ");
        signupOtpInput.value = "";
        signupOtpStatus.textContent = translations[currentLanguage].otpSent;
        signupOtpInput.focus();
    } catch (error) {
        signupOtpStatus.textContent = error.message || translations[currentLanguage].otpSendFailed;
    } finally {
        signupOtpResend.disabled = false;
    }
}

signupOtpResend.addEventListener("click", resendSignupOtp);

signupOtpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingSignup) return;
    const button = signupOtpForm.querySelector("button[type=submit]");
    button.disabled = true;
    signupOtpStatus.textContent = translations[currentLanguage].verifyingOtp;
    try {
        const response = await fetch(`${API_BASE}/api/auth/verify-signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingSignup.email, firebaseUid: pendingSignup.firebaseUid, otp: signupOtpInput.value.trim() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "OTP ไม่ถูกต้อง");
        const { user } = await signInWithEmailAndPassword(firebaseAuth, pendingSignup.email, pendingSignup.password);
        window.FMSAdminAudit?.log("create-account", { provider: "email", email: user.email || pendingSignup.email });
        pendingSignup = null;
        showSignedInMessage(user);
    } catch (error) {
        signupOtpStatus.textContent = error.message || translations[currentLanguage].otpInvalid;
        signupOtpInput.focus();
    } finally {
        button.disabled = false;
    }
});

resetEmailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!resetEmailInput.validity.valid) {
        resetEmailInput.focus();
        return;
    }
    const button = resetEmailForm.querySelector("button[type=submit]");
    button.disabled = true;
    resetStatus.textContent = translations[currentLanguage].sendingOtp;
    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmailInput.value.trim() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "ส่ง OTP ไม่สำเร็จ");
        resetEmailForm.hidden = true;
        resetOtpForm.hidden = false;
        resetStatus.textContent = translations[currentLanguage].otpSent;
        resetOtpInput.focus();
    } catch (error) {
        resetStatus.textContent = error.message || translations[currentLanguage].otpSendFailed;
    } finally {
        button.disabled = false;
    }
});

resetOtpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    resetStatus.textContent = translations[currentLanguage].verifyingOtp;
    try {
        const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmailInput.value.trim(), otp: resetOtpInput.value.trim() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "OTP ไม่ถูกต้อง");
        resetToken = result.resetToken;
        resetOtpForm.hidden = true;
        newPasswordForm.hidden = false;
        resetStatus.textContent = translations[currentLanguage].otpVerified;
        newPasswordInput.focus();
    } catch (error) {
        resetStatus.textContent = error.message || translations[currentLanguage].otpInvalid;
        resetOtpInput.focus();
    }
});

newPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (newPasswordInput.value.length < 6) {
        resetStatus.textContent = translations[currentLanguage].passwordTooShort;
        newPasswordInput.focus();
        return;
    }
    if (newPasswordInput.value !== confirmPasswordInput.value) {
        resetStatus.textContent = translations[currentLanguage].passwordMismatch;
        confirmPasswordInput.focus();
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmailInput.value.trim(), resetToken, password: newPasswordInput.value }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        resetStatus.textContent = translations[currentLanguage].passwordChanged;
        window.setTimeout(hideResetFlow, 1200);
    } catch (error) {
        resetStatus.textContent = error.message || translations[currentLanguage].passwordChangeFailed;
    }
});

function showSignedInMessage(user) {
    const userName = user.displayName || user.email || "Google user";
    statusText.textContent = currentLanguage === "th"
        ? `เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ${userName}`
        : `Signed in successfully. Welcome, ${userName}`;
    window.setTimeout(() => { window.location.href = "./menu.html"; }, 700);
}

function showFirebaseError(error) {
    const messages = {
        "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        "auth/email-already-in-use": "อีเมลนี้ถูกใช้งานแล้ว",
        "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        "auth/operation-not-allowed": "ยังไม่ได้เปิด Google ใน Firebase Console > Authentication > Sign-in method",
        "auth/unauthorized-domain": "เพิ่ม 127.0.0.1 ใน Firebase Console > Authentication > Settings > Authorized domains",
        "auth/popup-closed-by-user": "ปิดหน้าต่าง Google แล้ว"
    };
    statusText.textContent = messages[error.code] || error.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
    console.error("Firebase Authentication error:", error);
}

renderLanguage();
