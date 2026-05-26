# ARGUS Frontend

Role-aware web workspace for the ARGUS Online Computer-Based Examination Platform. This Next.js application authenticates against `Argus-Backend`, routes each user to the correct operational workspace, and keeps account creation behind authorized administration rather than public signup.

## Implemented Experience

- Branded login, forgot-password, reset-password, and forced password-change flows under the `(auth)` route group.
- Automatic role routing after login: administrators to `/admin/dashboard`, examiners to `/examiner/dashboard`, and candidates to `/candidate/dashboard`.
- Administrator account-provisioning form at `/admin/users/new` for candidates, examiners, and super-admin-authorized sub-admin creation.
- React Query API mutations and session queries with backend refresh-cookie rotation support.
- Sonner notifications for authentication, provisioning, and access-state feedback.
- Shadcn dashboard shell adapted into secure role-specific workspaces.

## Setup

Create an optional local environment file using `.env.local.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

The ARGUS backend must be running with CORS configured for `http://localhost:3000`.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

## Validation

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Security Note

There is intentionally no public signup page. The backend permits user creation only through protected administration endpoints, enforcing ARGUS role boundaries and sub-admin permission rules.
