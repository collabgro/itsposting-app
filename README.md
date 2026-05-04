# 🚀 PostFlow - AI Social Media SaaS

**AI-powered social media automation for local businesses.**

Generate professional content (text, images, carousels, videos) and auto-post to Facebook, Instagram, and Google Business Profile.

---

## ✨ Features

- 🤖 **Multiple AI Providers** - NanoBanana (Gemini 2.5 Flash Image), Midjourney, HeyGen
- 📱 **Multi-Platform** - Facebook, Instagram, Google Business
- 🎨 **4 Content Types** - Static cards, photos, carousels, videos
- 📅 **Smart Calendar** - Visual scheduling with monthly view
- 💳 **Credit System** - Transparent usage-based pricing
- 📊 **Analytics** - Track engagement metrics
- 🎨 **Custom Branding** - Brand colors, tone, visual style
- 📱 **Mobile-First** - Beautiful responsive UI

---

## 🍌 NanoBanana Integration (NEW)

**NanoBanana** = Google's Gemini 2.5 Flash Image — the recommended default provider:

| Feature | NanoBanana 🍌 | Midjourney 🎨 |
|---------|---------------|----------------|
| **Cost** | ~$0.039/image | ~$0.08/image |
| **Speed** | 3-8 seconds | 15-20 seconds |
| **Quality** | Excellent | Premium artistic |
| **Best for** | Daily posts | Hero images |
| **Editing** | ✅ Conversational | ❌ |

Customers can choose their preferred provider in Settings, or you can set the default via `IMAGE_PROVIDER` env var.

**Get your free Google AI API key:** https://aistudio.google.com/app/apikey

---

## 🚀 Quick Start (Replit)

### 1. Upload to Replit

1. Create new Repl → Import from upload
2. Upload `postflow-complete.zip`
3. Replit auto-detects Node.js + PostgreSQL

### 2. Set Up Database

In the Shell:
```bash
psql $DATABASE_URL -f backend/db/schema.sql
```

### 3. Configure Secrets

In Replit Secrets (lock icon), add:

**Required:**
- `ANTHROPIC_API_KEY` - https://console.anthropic.com
- `GOOGLE_AI_API_KEY` - https://aistudio.google.com/app/apikey (NanoBanana)
- `JWT_SECRET` - Any random 32+ character string
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - https://cloudinary.com

**Optional:**
- `REPLICATE_API_TOKEN` - For Midjourney fallback
- `HEYGEN_API_KEY` - For video generation

### 4. Install & Run

```bash
npm run install:all
npm run dev
```

✅ Frontend: http://localhost:3000  
✅ Backend: http://localhost:3001

---

## 🛠 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# 1. Install dependencies
npm run install:all

# 2. Create database
createdb socialmedia

# 3. Run schema
psql -d socialmedia -f backend/db/schema.sql

# 4. Configure env
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 5. Run
npm run dev
```

---

## 🔑 Environment Variables

See `backend/.env.example` for the full list. Minimum required:

```env
DATABASE_URL=postgresql://localhost:5432/socialmedia
JWT_SECRET=your-32-char-random-string
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_AI_API_KEY=your-google-ai-key  # NanoBanana
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
IMAGE_PROVIDER=nanobanana
```

---

## 📁 Project Structure

```
postflow/
├── backend/
│   ├── server.js                          # Express server
│   ├── routes/
│   │   ├── auth.js                        # Register, login
│   │   ├── customers.js                   # Profile CRUD
│   │   ├── posts.js                       # Posts CRUD
│   │   └── content.js                     # AI generation
│   ├── services/
│   │   ├── ClaudeService.js               # Caption generation
│   │   ├── NanoBananaService.js           # 🍌 Gemini 2.5 Flash Image
│   │   ├── MidjourneyService.js           # 🎨 Replicate/Midjourney
│   │   ├── HeyGenService.js               # 🎥 Video generation
│   │   └── ManualContentGenerator.js      # Orchestrator
│   ├── middleware/auth.js                 # JWT
│   └── db/schema.sql                      # PostgreSQL schema
│
└── frontend/
    ├── pages/
    │   ├── login.js, signup.js
    │   ├── dashboard.js
    │   ├── calendar.js
    │   ├── history.js
    │   └── settings.js                    # Provider selector here
    ├── components/
    │   ├── Layout.js
    │   └── ContentCreatorModal.js         # Shows active providers
    ├── lib/
    │   ├── store.js                       # Zustand
    │   └── api.js                         # Axios client
    └── styles/globals.css
```

---

## 💳 Pricing & Credits

| Plan | Price | Credits | Posts |
|------|-------|---------|-------|
| Starter | $99/mo | 50 | 3/week |
| Professional ⭐ | $199/mo | 150 | Daily |
| Premium | $349/mo | 500 | 2x daily |

**Credit costs per post type:**
- Static (text card): 1 credit
- Photo (NanoBanana): 3 credits
- Carousel (5 slides): 5 credits
- Video (HeyGen): 10 credits

**Auto-generated content is FREE** — credits only consumed for manual generation.

---

## 🎯 How It Works

1. **Sign up** → 7-day free trial + 10 free credits
2. **Configure brand** → Colors, tone, image provider preference
3. **Generate content** → AI creates posts from your prompts
4. **Schedule** → Calendar view for visual planning
5. **Analytics** → Track engagement across platforms

### Smart Provider Selection

The `ManualContentGenerator` picks the image provider based on:
1. Customer's `preferred_image_provider` (set in Settings)
2. Environment variable `IMAGE_PROVIDER` 
3. Available API keys (falls back gracefully)

```javascript
// In services/ManualContentGenerator.js
getImageService(customer) {
  const preference = customer.preferred_image_provider || process.env.IMAGE_PROVIDER;
  if (preference === 'midjourney' && process.env.REPLICATE_API_TOKEN) {
    return { service: this.midjourney, name: 'midjourney' };
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    return { service: this.nanobanana, name: 'nanobanana' };
  }
  // ... fallback chain
}
```

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token

### Customers
- `GET /api/customers/profile` - Get profile
- `PATCH /api/customers/profile` - Update profile
- `GET /api/customers/social-accounts` - List connected platforms

### Posts
- `GET /api/posts` - List posts (with filters)
- `GET /api/posts/upcoming` - Next 30 days
- `GET /api/posts/:id` - Single post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `GET /api/posts/analytics/summary` - Engagement metrics

### Content Generation
- `POST /api/content/generate` - Generate new post
- `GET /api/content/credits` - Credit balance
- `GET /api/content/credits/history` - Transaction log
- `GET /api/content/providers` - Available image providers

### Health
- `GET /health` - Service status (shows which AI services are configured)

---

## 🐛 Troubleshooting

### "NanoBanana not configured"
Add `GOOGLE_AI_API_KEY` to your environment. Get one free at https://aistudio.google.com/app/apikey

### Database connection error
```bash
# Check PostgreSQL is running
pg_isready

# Reinitialize
psql -d socialmedia -f backend/db/schema.sql
```

### Port already in use
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Cloudinary upload errors
Cloudinary credentials are required for image storage. The free tier (25GB) is plenty for testing.

---

## 📚 Resources

- **Anthropic Claude:** https://docs.claude.com
- **Google AI Studio (NanoBanana):** https://aistudio.google.com
- **Replicate (Midjourney):** https://replicate.com/docs
- **HeyGen API:** https://docs.heygen.com
- **Cloudinary:** https://cloudinary.com/documentation

---

## 📝 License

Proprietary — All rights reserved.

---

**Built for local businesses. Powered by AI.** 🚀
