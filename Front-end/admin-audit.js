// Authoritative audit entries are emitted by successful API transactions.
// Legacy callers are retained as no-ops to avoid duplicate, user-forged events.
window.FMSAdminAudit = { log() {}, logDeleted() {} };
