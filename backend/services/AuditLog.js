class AuditLog {
  constructor(pool) {
    this.pool = pool;
  }

  async log(adminId, adminEmail, action, targetType, targetId, details = {}, req = null) {
    try {
      const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0] || null;
      const userAgent = req?.headers?.['user-agent'] || null;
      await this.pool.query(
        `INSERT INTO admin_audit_log (admin_id, admin_email, action, target_type, target_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [adminId, adminEmail, action, targetType, targetId, JSON.stringify(details), ip, userAgent]
      );
    } catch (err) {
      console.error('Audit log error (non-fatal):', err.message);
    }
  }

  async getRecent(limit = 50) {
    const result = await this.pool.query(
      'SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1', [limit]
    );
    return result.rows;
  }

  async getForTarget(targetType, targetId) {
    const result = await this.pool.query(
      `SELECT * FROM admin_audit_log WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 100`,
      [targetType, targetId]
    );
    return result.rows;
  }
}

module.exports = AuditLog;
