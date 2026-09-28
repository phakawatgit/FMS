import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
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
const resetEmailForm = document.getElementById("resetEmailForm");
const resetOtpForm = document.getElementById("resetOtpForm");
const newPasswordForm = document.getElementById("newPasswordForm");
const resetEmailInput = document.getElementById("resetEmail");
const resetOtpInput = document.getElementById("resetOtp");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const demoOtp = document.getElementById("demoOtp");
const resetStatus = document.getElementById("resetStatus");
const ADMIN_SESSION_KEY = "fms-admin-session";
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "admin12345678";

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

let currentMode = "login";
let currentLanguage = "en";

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
        forgotProgress: "Password reset is ready to connect to the backend."
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
        forgotProgress: "ฟังก์ชันรีเซ็ตรหัสผ่านพร้อมเชื่อมต่อ backend"
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
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ username: ADMIN_USERNAME, role: "admin", signedInAt: new Date().toISOString() }));
        window.FMSAdminAudit?.log("login", { provider: "admin-demo", username: ADMIN_USERNAME });
        showSignedInMessage({ displayName: ADMIN_USERNAME, email: ADMIN_USERNAME });
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
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        window.FMSAdminAudit?.log("google-login", { email: result.user.email || "" });
        showSignedInMessage(result.user);
    } catch (error) {
        showFirebaseError(error);
    }
});

let resetOtpCode = "";

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
    resetOtpCode = "";
}

forgotButton.addEventListener("click", showResetFlow);
resetBackButton.addEventListener("click", hideResetFlow);

resetEmailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!resetEmailInput.validity.valid) {
        resetEmailInput.focus();
        return;
    }
    resetOtpCode = String(Math.floor(100000 + Math.random() * 900000));
    if (demoOtp) demoOtp.textContent = resetOtpCode;
    resetEmailForm.hidden = true;
    resetOtpForm.hidden = false;
    resetStatus.textContent = "โหมดจำลอง: แสดง OTP บนหน้าจอแทนการส่งอีเมล";
    resetOtpInput.focus();
});

resetOtpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (resetOtpInput.value.trim() !== resetOtpCode) {
        resetStatus.textContent = "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่";
        resetOtpInput.focus();
        return;
    }
    resetOtpForm.hidden = true;
    newPasswordForm.hidden = false;
    resetStatus.textContent = "ยืนยัน OTP สำเร็จ กรุณาตั้งรหัสผ่านใหม่";
    newPasswordInput.focus();
});

newPasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (newPasswordInput.value.length < 6) {
        resetStatus.textContent = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
        newPasswordInput.focus();
        return;
    }
    if (newPasswordInput.value !== confirmPasswordInput.value) {
        resetStatus.textContent = "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน";
        confirmPasswordInput.focus();
        return;
    }
    resetStatus.textContent = "โหมดจำลอง: เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง";
    window.setTimeout(hideResetFlow, 1200);
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
