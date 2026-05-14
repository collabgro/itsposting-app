const express = require('express');
const { authenticate, requireActiveAccount, getBillingCustomerId } = require('../middleware/auth');
const ManualContentGenerator = require('../services/ManualContentGenerator');

module.exports = (pool) => {
  const router = express.Router();
  const generator = new ManualContentGenerator(pool);

  /**
   * POST /api/content/generate
   */
  router.post('/generate', authenticate, requireActiveAccount(pool), async (req, res) => {
    try {
      const { contentType, prompt, options } = req.body;

      if (!contentType || !prompt) {
        return res.status(400).json({
          error: 'Missing required fields: contentType, prompt',
        });
      }

      const validTypes = ['static', 'photo', 'carousel', 'video'];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({
          error: `Invalid contentType. Must be: ${validTypes.join(', ')}`,
        });
      }

      const result = await generator.generateFromPrompt(
        req.customerId,
        contentType,
        prompt,
        options || {},
        getBillingCustomerId(req)
      );

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Content generation error:', error);

      if (error.message.includes('Insufficient credits')) {
        return res.status(402).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/content/credits
   */
  router.get('/credits', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT credits_balance, credits_used_this_month, plan
         FROM customers WHERE id = $1`,
        [req.customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const customer = result.rows[0];
      const planCredits = {
        trial: 10,
        starter: 50,
        professional: 150,
        premium: 500,
      };

      res.json({
        balance: customer.credits_balance,
        usedThisMonth: customer.credits_used_this_month,
        plan: customer.plan,
        monthlyAllowance: planCredits[customer.plan] || 0,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/content/credits/history
   */
  router.get('/credits/history', authenticate, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT ct.*, p.content_type, p.caption
         FROM credit_transactions ct
         LEFT JOIN posts p ON ct.post_id = p.id
         WHERE ct.customer_id = $1
         ORDER BY ct.created_at DESC
         LIMIT 50`,
        [req.customerId]
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/content/providers - Get available image providers
   */
  router.get('/providers', authenticate, async (req, res) => {
    const providers = {
      nanobanana: {
        name: 'NanoBanana',
        description: 'Google Gemini 2.5 Flash Image - Fast & affordable',
        cost_per_image: 0.039,
        speed: '3-8 seconds',
        available: !!process.env.GOOGLE_AI_API_KEY,
        recommended: true,
      },
      midjourney: {
        name: 'Midjourney',
        description: 'Premium quality via Replicate',
        cost_per_image: 0.08,
        speed: '15-20 seconds',
        available: !!process.env.REPLICATE_API_TOKEN,
        recommended: false,
      },
    };

    res.json(providers);
  });

  return router;
};
