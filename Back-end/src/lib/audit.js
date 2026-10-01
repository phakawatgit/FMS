// Store identifiers/counts, not patient bodies, credentials or access tokens.
async function audit(tx, req, action, entity, entityId, detail = {}) {
  return tx.auditLog.create({ data: { actorId: req.user?.id || null, action, entity, entityId: entityId || null, detail } });
}
module.exports = { audit };
