# Sirpi Frontend

Next.js 14 frontend with real-time deployment monitoring and AI assistant.

---

## Architecture

### Core Features

**Authentication** - Clerk for secure user management

**Real-time Updates** - Server-Sent Events for live deployment logs

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

### Real-time Logs (SSE)

```typescript
const eventSource = new EventSource(
  `${API_URL}/deployments/${id}/logs`
);

eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(log.message);
};
```

---

### Environment Variables

Required in deployment platform:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---