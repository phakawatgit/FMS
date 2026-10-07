import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
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
const signupOtpSubmit = document.getElementById("signupOtpSubmit");
const signupOtpResend = document.getElementById("signupOtpResend");
const resetEmailForm = document.getElementById("resetEmailForm");
const resetOtpForm = document.getElementById("resetOtpForm");
const newPasswordForm = document.getElementById("newPasswordForm");
const resetEmailInput = document.getElementById("resetEmail");
const resetOtpInput = document.getElementById("resetOtp");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const resetStatus = document.getElementById("resetStatus");
const API_BASE = window.FMS_API_URL || "";

async function establishApiSession(user) {
    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`${API_BASE}/api/auth/session`, {
            method: "POST",
            credentials: "include",
            headers: { Authorization: `Bearer ${idToken}` },
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not open a secure application session");
        return result.data.user;
    } catch (error) {
        await signOut(firebaseAuth);
        throw error;
    }
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Could not complete the request");
    return result;
}

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
let pendingSignupUser = null;
let resetEmail = "";
let resetToken = "";
let loginStatusMessage = null;

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
        signedIn: "Signed in successfully. Welcome, {name}",
        signupVerified: "Email verified. Please log in.",
        accountAlreadyLinked: "This account is already linked to another Firebase identity.",
        googleProgress: "Preparing Google sign-in...",
        forgotProgress: "Password reset is ready to connect to the backend.",
        resetBack: "Back to sign in",
        resetKicker: "PASSWORD RECOVERY",
        resetTitle: "Verify your email",
        resetDescription: "Enter your email to receive a password reset link",
        emailAddress: "Email address",
        sendOtp: "Send password reset link",
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
        signedIn: "เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ {name}",
        signupVerified: "ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ",
        accountAlreadyLinked: "บัญชีนี้เชื่อมโยงกับบัญชี Firebase อื่นอยู่แล้ว",
        googleProgress: "กำลังเตรียมเชื่อมต่อ Google...",
        forgotProgress: "ฟังก์ชันรีเซ็ตรหัสผ่านพร้อมเชื่อมต่อ backend",
        resetBack: "กลับไปเข้าสู่ระบบ",
        resetKicker: "กู้คืนรหัสผ่าน",
        resetTitle: "ยืนยันอีเมล",
        resetDescription: "กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่",
        emailAddress: "อีเมล",
        sendOtp: "ส่งลิงก์ตั้งรหัสผ่านใหม่",
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
    setText(document.getElementById("signupOtpDescription"), currentLanguage === "th" ? "กรอกรหัส OTP 6 หลักที่ส่งไปยังอีเมลของคุณ" : "Enter the 6-digit OTP sent to your email.");
    setText(signupOtpForm.querySelector("label"), t.otpLabel);
    setText(signupOtpForm.querySelector("button[type=submit]"), currentLanguage === "th" ? "ยืนยันอีเมล" : "Verify email");
    signupOtpForm.hidden = false;
    setText(signupOtpResend, currentLanguage === "th" ? "ส่ง OTP อีกครั้ง" : "Resend OTP");
    signupOtpInput.placeholder = t.otpPlaceholder;
    if (loginStatusMessage) {
        statusText.textContent = t[loginStatusMessage.key].replace("{name}", loginStatusMessage.name || "");
    }
}

function setLoginStatus(key, values = {}) {
    loginStatusMessage = { key, ...values };
    statusText.textContent = translations[currentLanguage][key].replace(/\{(\w+)\}/g, (_, name) => values[name] || "");
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
    loginStatusMessage = null;
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

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const t = translations[currentLanguage];
    setLoginStatus(currentMode === "signup" ? "signupProgress" : "loginProgress");
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    const fullName = document.getElementById("fullName").value.trim();
    if (currentMode === "signup") {
        submitButton.disabled = true;
        try {
            const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            if (fullName) await updateProfile(user, { displayName: fullName });
            pendingSignupUser = user;
            authForm.hidden = true;
            document.querySelector(".divider").hidden = true;
            googleButton.hidden = true;
            terms.hidden = true;
            signupOtpFlow.hidden = false;
            signupOtpEmail.textContent = email;
            const idToken = await user.getIdToken();
            await apiRequest("/api/auth/signup/otp/request", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
            signupOtpStatus.textContent = currentLanguage === "th" ? "ส่ง OTP 6 หลักไปยังอีเมลแล้ว" : "6-digit OTP sent to your email.";
        } catch (error) {
            if (pendingSignupUser) signupOtpStatus.textContent = error.message;
            else showFirebaseError(error);
        } finally {
            submitButton.disabled = false;
        }
        return;
    }
    signInWithEmailAndPassword(firebaseAuth, email, password).then(async ({ user }) => {
        await user.reload();
        if (!user.emailVerified) {
            const idToken = await user.getIdToken();
            await apiRequest("/api/auth/signup/otp/request", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
            pendingSignupUser = user;
            signupOtpEmail.textContent = user.email || email;
            signupOtpStatus.textContent = currentLanguage === "th" ? "ส่ง OTP 6 หลักไปยังอีเมลแล้ว" : "6-digit OTP sent to your email.";
            authForm.hidden = true;
            document.querySelector(".divider").hidden = true;
            googleButton.hidden = true;
            terms.hidden = true;
            signupOtpFlow.hidden = false;
            return;
        }
        await establishApiSession(user);
        window.FMSAdminAudit?.log("login", { provider: "email", email: user.email || email });
        showSignedInMessage(user);
    }).catch(showFirebaseError);
});

googleButton.addEventListener("click", async () => {
    setLoginStatus("googleProgress");
    try {
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        await establishApiSession(result.user);
        window.FMSAdminAudit?.log("google-login", { email: result.user.email || "" });
        showSignedInMessage(result.user);
    } catch (error) {
        showFirebaseError(error);
    }
});

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
}

forgotButton.addEventListener("click", showResetFlow);
resetBackButton.addEventListener("click", hideResetFlow);

signupOtpBack.addEventListener("click", async () => {
    await signOut(firebaseAuth).catch(() => {});
    signupOtpFlow.hidden = true;
    authForm.hidden = false;
    document.querySelector(".divider").hidden = false;
    googleButton.hidden = false;
    terms.hidden = false;
    signupOtpInput.value = "";
    signupOtpStatus.textContent = "";
    pendingSignupUser = null;
});

async function requestSignupOtp() {
    if (!pendingSignupUser) throw new Error("Sign in or create an account again to request an OTP.");
    const idToken = await pendingSignupUser.getIdToken();
    await apiRequest("/api/auth/signup/otp/request", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
}

signupOtpResend.addEventListener("click", async () => {
    signupOtpResend.disabled = true;
    try {
        await requestSignupOtp();
        signupOtpStatus.textContent = currentLanguage === "th" ? "ส่ง OTP อีกครั้งแล้ว" : "OTP resent.";
    } catch (error) { signupOtpStatus.textContent = error.message; }
    finally { signupOtpResend.disabled = false; }
});

signupOtpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingSignupUser) return;
    signupOtpSubmit.disabled = true;
    try {
        const idToken = await pendingSignupUser.getIdToken();
        await apiRequest("/api/auth/signup/otp/verify", { method: "POST", headers: { Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ code: signupOtpInput.value.trim() }) });
        await signOut(firebaseAuth);
        pendingSignupUser = null;
        signupOtpFlow.hidden = true;
        authForm.hidden = false;
        document.querySelector(".divider").hidden = false;
        googleButton.hidden = false;
        terms.hidden = false;
        signupOtpInput.value = "";
        signupOtpStatus.textContent = "";
        setMode("login");
        passwordInput.value = "";
        document.getElementById("email").focus();
        setLoginStatus("signupVerified");
    } catch (error) { signupOtpStatus.textContent = error.message; }
    finally { signupOtpSubmit.disabled = false; }
});

resetEmailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = resetEmailInput.value.trim();
    if (!resetEmailInput.validity.valid) { resetEmailInput.focus(); return; }
    const button = resetEmailForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        await apiRequest("/api/auth/password-reset/otp/request", { method: "POST", body: JSON.stringify({ email }) });
        resetEmail = email;
        resetEmailForm.hidden = true;
        resetOtpForm.hidden = false;
        resetStatus.textContent = currentLanguage === "th" ? "ส่ง OTP 6 หลักไปยังอีเมลแล้ว" : "6-digit OTP sent to your email.";
        resetOtpInput.focus();
    } catch (error) {
        resetStatus.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

resetOtpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const result = await apiRequest("/api/auth/password-reset/otp/verify", { method: "POST", body: JSON.stringify({ email: resetEmail, code: resetOtpInput.value.trim() }) });
        resetToken = result.resetToken;
        resetOtpForm.hidden = true;
        newPasswordForm.hidden = false;
        resetStatus.textContent = currentLanguage === "th" ? "ยืนยัน OTP แล้ว ตั้งรหัสผ่านใหม่ได้เลย" : "OTP verified. Set a new password.";
        newPasswordInput.focus();
    } catch (error) { resetStatus.textContent = error.message; }
});

newPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (newPasswordInput.value !== confirmPasswordInput.value) {
        resetStatus.textContent = currentLanguage === "th" ? "รหัสผ่านไม่ตรงกัน" : "Passwords do not match.";
        return;
    }
    try {
        await apiRequest("/api/auth/password-reset/complete", { method: "POST", body: JSON.stringify({ email: resetEmail, resetToken, password: newPasswordInput.value }) });
        resetStatus.textContent = currentLanguage === "th" ? "เปลี่ยนรหัสผ่านสำเร็จแล้ว" : "Password updated successfully.";
        window.setTimeout(hideResetFlow, 1800);
    } catch (error) { resetStatus.textContent = error.message; }
});

function showSignedInMessage(user) {
    const userName = user.displayName || user.email || "Google user";
    setLoginStatus("signedIn", { name: userName });
    window.setTimeout(() => { window.location.href = "./menu.html"; }, 700);
}

function showFirebaseError(error) {
    const isAccountAlreadyLinked = error.code === "auth/account-exists-with-different-credential"
        || error.code === "auth/credential-already-in-use"
        || /account is already linked to another firebase identity/i.test(error.message || "");
    if (isAccountAlreadyLinked) {
        setLoginStatus("accountAlreadyLinked");
        console.error("Firebase Authentication error:", error);
        return;
    }
    const messages = {
        "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
        "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        "auth/email-already-in-use": "อีเมลนี้ถูกใช้งานแล้ว",
        "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        "auth/operation-not-allowed": "กรุณาเปิด Email/Password และ Google ใน Firebase Console > Authentication > Sign-in method",
        "auth/unauthorized-domain": "เพิ่ม localhost และโดเมนที่ใช้เข้าเว็บใน Firebase Console > Authentication > Settings > Authorized domains",
        "auth/network-request-failed": "เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่",
        "auth/too-many-requests": "มีการลองมากเกินไป กรุณารอสักครู่แล้วลองใหม่",
        "auth/missing-email": "กรุณากรอกอีเมล",
        "auth/popup-closed-by-user": "ปิดหน้าต่าง Google แล้ว"
    };
    loginStatusMessage = null;
    statusText.textContent = messages[error.code] || error.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
    console.error("Firebase Authentication error:", error);
}

renderLanguage();
