# Sirpi Frontend

Next.js frontend for AI-Native DevOps Automation Platform.

**TypeScript + Tailwind CSS + Clerk Auth**

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Run development server
npm run dev

# Available at: http://localhost:3000
```

## Environment Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# GitHub App Configuration
NEXT_PUBLIC_GITHUB_APP_NAME=your-app-name
NEXT_PUBLIC_GITHUB_BASE_URL=https://github.com
NEXT_PUBLIC_GITHUB_API_BASE_URL=https://api.github.com
```

## Development

```bash
# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm run start
```

## Project Structure

- `src/app/` - Next.js App Router pages and layouts
- `src/components/` - Reusable React components
- `src/lib/` - API clients and utilities
- `src/middleware.ts` - Route protection middleware

## Key Features

- 🔐 **Authentication** - Clerk-powered user management
- 🔗 **GitHub Integration** - Repository import and management
- 📊 **Real-time Updates** - Server-Sent Events for live progress
- 🎨 **Responsive Design** - Mobile-first Tailwind CSS
- 🌙 **Dark Mode** - Theme switching support

## Deployment

```bash
# Deploy to Vercel
npm i -g vercel
vercel --prod
```