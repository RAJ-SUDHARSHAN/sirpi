# Sirpi Frontend

Next.js 14 frontend with real-time deployment monitoring and AI assistant.

---

## Architecture

### Core Features

**Authentication** - Clerk for secure user management

**Real-time Updates** - HTTP polling for live deployment logs via API Gateway

**AI Chat** - Context-aware assistant powered by Amazon Nova Pro

**Repository Management** - GitHub OAuth integration

**Deployment Dashboard** - Live status tracking and infrastructure management

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Clerk account

### Installation

```bash
cd frontend

npm install
# or
yarn install
```

### Environment Configuration

Create `.env.local`:

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

Application available at `http://localhost:3000`

---

## API Integration

### API Client

```typescript
import { apiClient } from '@/lib/api';

const repos = await apiClient.get('/github/repos');
const deployment = await apiClient.post('/deployments/create', data);
```

### Real-time Logs (HTTP Polling)
- Polls `/deployment/operations/{operation_id}/logs?since_index=X` every 2 seconds
- Backend returns only new logs since last index (efficient incremental fetch)
- Frontend displays logs in real-time as they arrive
- Automatic cleanup when operation completes

**Why polling?**  
API Gateway HTTP API buffers responses, preventing true Server-Sent Events streaming. Polling at 2-second intervals provides acceptable near real-time experience for deployment operations that take minutes to complete.
```

---

### Environment Variables

Required in deployment platform:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---