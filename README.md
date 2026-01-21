# 🚀 Heliox Proxy

<div align="center">

![Heliox Logo](https://img.shields.io/badge/Heliox-API%20Gateway-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJMMyAxNGgxMGwtMSAxMCAxMC0xMkgxMmwxLTEweiIvPjwvc3ZnPg==)

**A modern, high-performance API Gateway with intelligent caching, rate limiting, and analytics.**

[![Live Demo](https://img.shields.io/badge/🌐_Gateway-Live-success?style=flat-square)](https://heliox-gateway.onrender.com)
[![Admin Panel](https://img.shields.io/badge/🔧_Admin-Panel-blue?style=flat-square)](https://heliox-proxy.vercel.app)
[![Customer Portal](https://img.shields.io/badge/👤_Customer-Portal-purple?style=flat-square)](https://heliox-portal.vercel.app)

</div>

---

## 🌐 Live Deployment

| Service | URL |
|---------|-----|
| **API Gateway** | https://heliox-gateway.onrender.com/health |
| **Admin Panel** | https://heliox-proxy.vercel.app |
| **Customer Portal** | https://heliox-portal.vercel.app |
| **API Documentation** | https://heliox-gateway.onrender.com/docs |
| **ReDoc** | https://heliox-gateway.onrender.com/redoc |

---

## ✨ Features

### 🔐 API Key Management
- Generate and manage API keys per tenant
- Key rotation and revocation
- Usage quotas (daily/monthly limits)
- Key prefixes for easy identification

### ⚡ Intelligent Caching
- Response caching with configurable TTL
- Cache policies per route
- Cache hit/miss analytics
- Automatic cache invalidation

### 🛡️ Rate Limiting
- Per-key rate limiting (requests per second)
- Burst allowance configuration
- Token bucket algorithm
- Real-time quota tracking

### 📊 Analytics & Monitoring
- Real-time request logging
- Latency tracking
- Error rate monitoring
- Cache performance metrics
- Usage dashboards

### 🚨 Abuse Detection
- Anomaly detection using EWMA + Z-score
- Automatic key blocking
- Bloom filter for 404 caching
- IP-based tracking

### 🧮 Advanced Algorithms
- **Token Bucket** - Burst-friendly rate limiting
- **Leaky Bucket** - Smooth traffic shaping
- **Sliding Window** - Precise rate counting
- **Circuit Breaker** - Upstream protection with half-open recovery
- **EWMA (Exponential Weighted Moving Average)** - Trend tracking for abuse detection
- **Z-Score Anomaly Detection** - Statistical outlier identification
- **Bloom Filter** - Probabilistic 404 negative caching
- **Count-Min Sketch** - Space-efficient frequency counting
- **HyperLogLog** - Cardinality estimation for unique visitors
- **Consistent Hashing** - Distributed key routing with virtual nodes
- **Priority Queue** - Request prioritization
- **Exponential Backoff** - Retry strategies with jitter
- **Adaptive Rate Limiting** - Dynamic limits based on system load

### 💳 Multi-Tenant Architecture
- Isolated tenants with dedicated resources
- Subscription plans (Free, Pro, Enterprise)
- Per-tenant quotas and limits
- Role-based access control

---

## 🧮 Algorithms Deep Dive

### Rate Limiting

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **Token Bucket** | Tokens regenerate at fixed rate, allows bursts up to bucket size | Default rate limiting, bursty traffic |
| **Leaky Bucket** | Requests leak at constant rate, enforces strict output rate | Traffic shaping, smooth output |
| **Sliding Window** | Counts requests in rolling time window | Precise rate limiting |

### Traffic Management

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **Circuit Breaker** | Three states (Closed→Open→Half-Open), protects upstream services | Prevent cascade failures |
| **Adaptive Rate Limiter** | Adjusts limits based on system load using EWMA smoothing | Auto-scaling protection |
| **Priority Queue** | Heap-based prioritization with O(log n) operations | Premium tier fast-tracking |
| **Exponential Backoff** | Retry delays: `min(base * 2^attempt, max) + jitter` | Upstream retry logic |

### Anomaly Detection

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **EWMA** | `EWMA_new = α × value + (1-α) × EWMA_old` | Smooth trend tracking |
| **Z-Score** | `z = (x - μ) / σ` detects statistical outliers | Abuse detection (z > 3) |

### Probabilistic Data Structures

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **Bloom Filter** | Bit array + k hash functions, O(k) lookup | 404 negative caching |
| **Count-Min Sketch** | 2D array with d hash functions, frequency estimation | Hot key detection |
| **HyperLogLog** | Cardinality estimation with ~2% error | Unique visitor counting |

### Distributed Systems

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **Consistent Hashing** | Ring-based routing with virtual nodes | Load balancing, cache sharding |

```
Bloom Filter Visualization:
┌─────────────────────────────────────┐
│ Bit Array: [0,1,0,1,1,0,0,1,0,1...] │
├─────────────────────────────────────┤
│ "path" → hash₁=3, hash₂=7, hash₃=9  │
│ Check bits[3,7,9] → all 1? Maybe in │
│ Any 0? Definitely NOT in set        │
└─────────────────────────────────────┘

Circuit Breaker State Machine:
┌────────┐  failure threshold  ┌──────┐
│ CLOSED │ ─────────────────→ │ OPEN │
└────────┘                     └──────┘
     ↑                            │
     │ success                    │ timeout
     │                            ↓
     │                      ┌───────────┐
     └───────────────────── │ HALF-OPEN │
         success threshold  └───────────┘
```

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Customer       │     │  Admin          │     │  API Gateway    │
│  Portal         │     │  Panel          │     │  (FastAPI)      │
│  (Next.js)      │     │  (Next.js)      │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────┴─────┐           ┌───────┴───────┐
              │ PostgreSQL│           │    Redis      │
              │ (Neon)    │           │  (Upstash)    │
              └───────────┘           └───────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (Neon)
- **Cache:** Redis (Upstash)
- **ORM:** SQLAlchemy (async)
- **Migrations:** Alembic
- **Auth:** JWT (python-jose)
- **Email:** Resend API / SMTP

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** React Query (TanStack)
- **Icons:** Lucide React

### Infrastructure
- **Gateway Hosting:** Render
- **Frontend Hosting:** Vercel
- **Database:** Neon (Serverless Postgres)
- **Cache:** Upstash Redis

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis (optional - demo mode available)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ankurrawat-12/Heliox_Proxy.git
   cd Heliox_Proxy
   ```

2. **Set up the backend**
   ```bash
   cd apps/gateway-api
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

5. **Start the API server**
   ```bash
   uvicorn src.main:app --reload --port 8000
   ```

6. **Set up the Admin UI**
   ```bash
   cd ui/admin
   npm install
   npm run dev
   ```

7. **Set up the Customer Portal**
   ```bash
   cd ui/portal
   npm install
   npm run dev
   ```

### Using Docker

```bash
# Build and start all services
docker-compose -f infra/docker-compose.yml up --build

# Or use the Makefile
make up
```

---

## ⚙️ Environment Variables

### Backend (Gateway API)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection URL | Required |
| `REDIS_URL` | Redis connection URL | Optional |
| `SECRET_KEY` | JWT signing key | Required |
| `ADMIN_API_KEY` | Admin authentication key | Required |
| `RESEND_API_KEY` | Resend email API key | Optional |
| `SKIP_EMAIL_VERIFICATION` | Skip OTP verification (dev mode) | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `FRONTEND_URL` | Portal URL for email links | `http://localhost:3000` |

### Frontend (Admin & Portal)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |

See `env.example` for all available options.

---

## 📖 API Documentation

### Authentication

All gateway requests require an API key in the `X-Api-Key` header:

```bash
curl -H "X-Api-Key: hx_your_api_key_here" \
     https://heliox-gateway.onrender.com/g/your-route/endpoint
```

### Gateway Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `*` | `/g/{route_path}/**` | Proxy requests through the gateway |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | OpenAPI documentation |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/tenants` | List all tenants |
| `POST` | `/admin/tenants` | Create a tenant |
| `GET` | `/admin/keys` | List all API keys |
| `POST` | `/admin/keys` | Create an API key |
| `GET` | `/admin/routes` | List all routes |
| `POST` | `/admin/routes` | Create a route |

### Portal Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Create account |
| `POST` | `/auth/login` | Login |
| `GET` | `/portal/tenant` | Get tenant info |
| `GET` | `/portal/keys` | List user's API keys |
| `GET` | `/portal/usage` | Get usage statistics |

---

## 📁 Project Structure

```
heliox_proxy/
├── apps/
│   └── gateway-api/          # FastAPI backend
│       ├── src/
│       │   ├── api/          # API routes
│       │   ├── models/       # SQLAlchemy models
│       │   ├── schemas/      # Pydantic schemas
│       │   ├── services/     # Business logic
│       │   └── main.py       # Application entry
│       ├── alembic/          # Database migrations
│       └── requirements.txt
├── ui/
│   ├── admin/                # Admin panel (Next.js)
│   │   └── src/
│   │       ├── app/          # App router pages
│   │       ├── components/   # React components
│   │       └── lib/          # Utilities & API client
│   └── portal/               # Customer portal (Next.js)
│       └── src/
│           ├── app/          # App router pages
│           ├── components/   # React components
│           └── lib/          # Utilities & API client
├── infra/
│   └── docker-compose.yml    # Docker configuration
├── env.example               # Environment template
├── Makefile                  # Development commands
└── README.md
```

---

## 🔧 Development Commands

```bash
# Start all services
make up

# View logs
make logs

# Run database migrations
make migrate

# Seed database
make seed

# Stop all services
make down

# Clean up (remove volumes)
make clean
```

---

## 🚢 Deployment

### Render (Backend)

1. Create a new **Web Service**
2. Connect your GitHub repository
3. Set **Root Directory:** `apps/gateway-api`
4. Set **Build Command:** `pip install -r requirements.txt`
5. Set **Start Command:** `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `env.example`

### Vercel (Frontend)

**Admin Panel:**
1. Import project from GitHub
2. Set **Root Directory:** `ui/admin`
3. Add `NEXT_PUBLIC_API_URL` environment variable

**Customer Portal:**
1. Import project from GitHub
2. Set **Root Directory:** `ui/portal`
3. Add `NEXT_PUBLIC_API_URL` environment variable

---

## 🧪 Testing the Gateway

```bash
# Create a test request through the gateway
curl -v -H "X-Api-Key: YOUR_API_KEY" \
     "https://heliox-gateway.onrender.com/g/your-route/endpoint"

# Check cache headers
# x-cache: HIT (from cache)
# x-cache: MISS (from upstream)
```

---

## 📊 Subscription Plans

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Daily Requests | 1,000 | 50,000 | Unlimited |
| Monthly Requests | 10,000 | 500,000 | Unlimited |
| API Keys | 2 | 10 | Unlimited |
| Routes | 5 | 25 | Unlimited |
| Rate Limit | 10 RPS | 100 RPS | Custom |
| Caching | ✅ | ✅ | ✅ |
| Analytics | Basic | Advanced | Advanced |
| Support | Community | Email | Priority |

---

## 👥 Founders

<table>
  <tr>
    <td align="center">
      <b>Jay Bankoti</b><br>
      <sub>Founder</sub>
    </td>
    <td align="center">
      <b>Ankur Rawat</b><br>
      <sub>Co-Founder</sub>
    </td>
    <td align="center">
      <b>Kushagra Gupta</b><br>
      <sub>Co-Founder</sub>
    </td>
  </tr>
</table>

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">

**Built with ❤️ by the Heliox Team**

[Website](https://heliox-portal.vercel.app) • [Documentation](https://heliox-gateway.onrender.com/docs) • [Report Bug](https://github.com/Ankurrawat-12/Heliox_Proxy/issues)

</div>
