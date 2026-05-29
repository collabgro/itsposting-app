const webpush = require('web-push');

let configured = false;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'support@itsposting.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

/**
 * Send a push notification to a single subscription object.
 * Returns { expired: true } if the subscription has been revoked (410/404).
 * Returns null on success or if web push is not configured.
 */
async function sendPush(subscription, payload) {
  if (!configured) return null;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return null;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { expired: true, endpoint: subscription.endpoint };
    }
    console.error('[WebPushService] send error:', err.message);
    return null;
  }
}

/**
 * Send a push notification to all subscriptions for a customer.
 * Expired subscriptions are deleted from the pool automatically.
 */
async function sendToCustomer(pool, customerId, payload) {
  if (!configured) return;
  let rows;
  try {
    const result = await pool.query(
      'SELECT id, subscription FROM push_subscriptions WHERE customer_id = $1',
      [customerId]
    );
    rows = result.rows;
  } catch (err) {
    console.error('[WebPushService] DB read error:', err.message);
    return;
  }

  for (const row of rows) {
    let sub;
    try { sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription; }
    catch { continue; }

    const result = await sendPush(sub, payload);
    if (result?.expired) {
      pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]).catch(() => {});
    }
  }
}

module.exports = { sendPush, sendToCustomer, configured: () => configured };
