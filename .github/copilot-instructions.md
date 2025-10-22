# SmartLock Tuya - AI Coding Agent Instructions

> **Versão em Português:** Veja [`copilot-instructions-pt.md`](./copilot-instructions-pt.md)

## Project Overview
**SmartLockTuya** is an Express.js + PostgreSQL application for controlling Tuya IoT smart locks through a web dashboard. Users authenticate, configure Tuya API credentials, manage locks, and create temporary access passwords.

### Tech Stack
- **Backend:** Node.js + Express.js, PostgreSQL 
- **Frontend:** Vanilla JavaScript + HTML/CSS
- **External Integration:** Tuya Cloud API (HMAC-SHA256 signing)
- **Auth:** JWT tokens + express-session, bcrypt password hashing

---

## Architecture Overview

### Three-Layer Request Flow
1. **Frontend** (`public/*.html`) → Sends `Authorization: Bearer <JWT>` headers
2. **Middleware** (`middleware/auth.js`) → Validates JWT, populates `req.user`, checks Tuya config
3. **API Routes** (`server.js`) → Queries PostgreSQL, calls Tuya API with cached tokens

### Key Components

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **Auth System** | User registration, JWT tokens, session management | `routes/auth.js`, `middleware/auth.js` |
| **Tuya API Bridge** | HMAC-SHA256 signing, token caching, device control | `server.js` (lines 36-89) |
| **Lock Management** | CRUD locks, fetch device status, manage passwords | `server.js` (lines 91-420) |
| **Database** | PostgreSQL with user/lock/config/logs tables | `config/database.js`, `database_schema.sql` |

---

## Critical Patterns

### Authentication Flow
```javascript
// JWT stored in localStorage, sent as Bearer token in all protected requests
const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization'].split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    req.user = await query('SELECT ... FROM users WHERE id = $1', [decoded.userId]);
    next();
  });
};
```
- Token issued on login: `POST /api/auth/login` returns `{token, id, nome}`
- Protected routes always call `authenticateToken` first
- Session secret must be provided in `.env`: `SESSION_SECRET=your-secret-key`

### Tuya API Integration Pattern
```javascript
// Unique pattern: Token caching + HMAC signing on every request
async function ensureToken(userId, tuyaConfig) {
  const cached = tokenCache.get(`user_${userId}`);
  if (cached && Date.now() < cached.expireTime - 60000) return cached.accessToken;
  // Otherwise fetch new token with HMAC-SHA256 signature
}

// All Tuya API calls require these headers:
headers: {
  client_id: tuyaConfig.client_id,
  access_token: accessToken,
  sign: generateSign(...), // HMAC-SHA256 hash
  sign_method: 'HMAC-SHA256',
  t: Date.now().toString()
}
```
- **Token cache** prevents excessive API calls (stored in memory Map)
- **Signature generation** in `generateSign()` and `generateTokenSign()` uses SHA256 HMAC
- **Region host** (e.g., `openapi.tuyaus.com`) configured per user in settings

### Temporary Password Creation (Complex Multi-Step)
Three-step process stored as pattern in `server.js` lines 380-450:
1. **Get ticket** → POST to `/v1.0/devices/{deviceId}/door-lock/password-ticket`
2. **Decrypt ticket_key** → AES-256-ECB with client_secret, extract encryption key
3. **Encrypt password** → AES-128-ECB with 16-byte key, send as hex string

```javascript
// Example: Why this matters - password MUST be 7 digits, encrypted with key derived from ticket
if (!password || password.length !== 7) {
  return res.status(400).json({ error: 'Password must have exactly 7 digits' });
}
```

### Database Query Pattern
All queries use parameterized statements with PostgreSQL client:
```javascript
const result = await query(
  'INSERT INTO locks (user_id, device_id, nome) VALUES ($1, $2, $3) RETURNING *',
  [req.user.id, deviceId, name]
);
```
- Always use `$1, $2` placeholders (prevents SQL injection)
- Queries defined in `config/database.js` Pool instance
- Connection pool has 20 max clients, 30s idle timeout

### Frontend Auth Pattern
Every HTML page:
```javascript
function checkAuth() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});
```

---

## Common Workflows

### Adding a Protected Route
1. Create endpoint in `server.js` with `authenticateToken` middleware
2. If accessing Tuya API, also add `requireTuyaConfig` middleware
3. Use `req.user.id` and `req.tuyaConfig` from middleware setup
4. Return `{success: true, result: ...}` on success, `{success: false, error: msg}` on failure

### Calling Tuya API from Frontend
```javascript
// 1. Ensure user configured Tuya credentials in Settings
// 2. Fetch with Bearer token
const res = await fetch('/api/device/{deviceId}/status', {
  headers: getHeaders()
});
const data = await res.json();
if (data.success) { /* use data.result */ }
```

### Creating Temporary Password
1. User fills form: name, 7-digit code, start/end datetime (format: `YYYY-MM-DD` + `HH:mm`)
2. Frontend POST to `/api/device/{deviceId}/temp-password` with encrypted payload
3. Server validates 7-digit rule, calls Tuya 3-step process
4. Returns success/error to display in UI alert

---

## Environment Variables
Required in `.env`:
```
NODE_ENV=development
PORT=3000
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret-key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tuya_locks_db
DB_USER=tuya_admin
DB_PASSWORD=password
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=app-password
APP_URL=http://localhost:3000
```

---

## Error Handling Convention
- **Frontend alerts** (bottom-right): `showAlert(message, 'success'|'error')`
- **API errors** return: `{success: false, error: 'message'}` or `{success: false, errors: [...]}`
- **Tuya API failures** logged to console, return HTTP status 500

---

## Key Files Reference
| Path | Purpose |
|------|---------|
| `server.js` | Main Express app, Tuya API integration, routes |
| `routes/auth.js` | Register, login, verify email, reset password |
| `middleware/auth.js` | JWT validation, Tuya config check, activity logging |
| `config/database.js` | PostgreSQL pool configuration |
| `database_schema.sql` | Schema definition (users, locks, tuya_configs, logs) |
| `public/dashboard.html` | Main user interface |
| `public/settings.html` | Tuya credential configuration |
| `public/locks.html` | Lock CRUD management |
| `public/passwords.html` | Temporary password creation/deletion |

---

## Next Steps / Known Issues
Check `Próximos Passos/Sistema.txt` for feature backlog:
- Fix locks not loading in locks.html
- Implement search system
- Add multi-user account sharing
- WhatsApp notification integration
