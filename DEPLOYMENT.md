# 🚀 Deployment Guide - Virtual Lab Agama Kristen

## 📋 Quick Summary

Project ini sudah di-migrate dari MongoDB → **Supabase (PostgreSQL)** ✅

## ✅ What's Done

- [x] Database connection (Supabase)
- [x] User model updated
- [x] Auth endpoints updated (register, login, profile)
- [x] Progress endpoints updated
- [x] Environment variables configured
- [x] Dependencies installed

## 🔧 Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

File `.env` sudah ada dengan credentials Supabase:

```env
SUPABASE_URL=https://lbslcllhpyetvsbpcvqp.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
JWT_SECRET=Ldw8fj4xbE
```

### 3. Setup Database

Follow instructions in `SETUP_DATABASE.md`:

1. Open Supabase SQL Editor
2. Run the SQL script to create tables
3. Verify tables are created

### 4. Install Netlify CLI (Optional)

```bash
npm install -g netlify-cli
```

### 5. Run Locally

```bash
netlify dev
```

Atau langsung deploy ke Netlify.

## 🌐 Deployment to Netlify

### Option 1: Git Push (Recommended)

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Migrate to Supabase PostgreSQL"
   git push origin main
   ```

2. **Netlify auto-deploys** from GitHub!

### Option 2: Netlify CLI

```bash
# Login to Netlify
netlify login

# Link to existing site or create new
netlify link

# Deploy
netlify deploy --prod
```

## ⚙️ Environment Variables in Netlify

**IMPORTANT:** Set these in Netlify Dashboard!

1. Go to: [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. **Site Settings** → **Environment Variables**
4. Add these 4 variables:

```
SUPABASE_URL=https://lbslcllhpyetvsbpcvqp.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=Ldw8fj4xbE
```

5. **Save** → **Trigger deploy**

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)
- `PUT /api/auth/profile` - Update profile (requires token)
- `PUT /api/auth/password` - Change password (requires token)
- `POST /api/auth/logout` - Logout

### Progress

- `POST /api/progress/quiz` - Save quiz results
- `POST /api/progress/assignment` - Submit assignment
- `POST /api/progress/journal` - Add journal entry
- `POST /api/progress/material-viewed` - Mark material as viewed
- `POST /api/progress/video-watched` - Mark video as watched
- `GET /api/progress/overview` - Get user progress overview
- `GET /api/progress/quiz` - Get quiz history
- `GET /api/progress/assignment` - Get assignments
- `GET /api/progress/journal` - Get journal entries
- `PUT /api/progress/journal/:id` - Update journal entry
- `DELETE /api/progress/journal/:id` - Delete journal entry

## 🧪 Testing

### Test Registration

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/server/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "nim": "13520001",
    "kelas": "K01",
    "gender": "Laki-laki"
  }'
```

### Test Login

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/server/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🗂️ File Structure

```
UTS-II3140-Pengembangan-Aplikasi-Web-dan-Mobile/
│
├── .env                        # Environment variables (LOCAL ONLY)
├── .env.example               # Template for environment variables
├── .gitignore                 # Ignore .env and sensitive files
├── netlify.toml               # Netlify configuration
├── package.json               # Dependencies
│
├── netlify/functions/
│   ├── server.js              # Main router/dispatcher
│   ├── auth.js                # Auth endpoints
│   ├── progress.js            # Progress endpoints
│   │
│   ├── db/
│   │   ├── index.js           # Supabase connection
│   │   └── progress.js        # Progress helper functions
│   │
│   └── models/
│       └── user.js            # User model (Supabase)
│
├── js/                        # Frontend JavaScript
│   ├── auth.js
│   ├── page-protection.js
│   └── progress.js
│
├── *.html                     # HTML pages
├── style.css                  # Styles
└── assets/                    # Images, PDFs, etc.
```

## 🔒 Security Notes

1. **Never commit `.env`** to GitHub (already in `.gitignore`)
2. **`SUPABASE_ANON_KEY`** → Safe for frontend
3. **`SUPABASE_SERVICE_KEY`** → Backend ONLY! Never expose to frontend
4. **JWT_SECRET** → Keep secret, minimum 32 characters
5. **Row Level Security (RLS)** enabled in Supabase

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Check `.env` file exists locally
- Check environment variables set in Netlify Dashboard

### "User tidak ditemukan" after login
- Run database setup script
- Check table exists: `SELECT * FROM users LIMIT 1;`

### "Token tidak valid"
- Make sure `JWT_SECRET` is same in local and Netlify
- Token might be expired (7 days default)

### CORS errors
- CORS headers already configured in all endpoints
- Check browser console for exact error

## 📊 Database Monitoring

Monitor your database in Supabase:

1. [Database](https://app.supabase.com/project/lbslcllhpyetvsbpcvqp/database/tables) - View tables
2. [SQL Editor](https://app.supabase.com/project/lbslcllhpyetvsbpcvqp/sql) - Run queries
3. [Logs](https://app.supabase.com/project/lbslcllhpyetvsbpcvqp/logs/postgres-logs) - Check errors

## 📈 Next Steps

- [ ] Test all endpoints
- [ ] Update frontend to use new API
- [ ] Add error handling in frontend
- [ ] Add loading states
- [ ] Test offline fallback
- [ ] Deploy to Netlify
- [ ] Test in production

## 🎉 You're Ready!

Project sudah siap di-deploy! Just push to GitHub atau run `netlify deploy --prod`! 🚀

---

**Built with:**
- Frontend: Vanilla HTML/CSS/JS
- Backend: Netlify Functions (Node.js)
- Database: Supabase (PostgreSQL)
- Auth: JWT
- Deployment: Netlify
