# BikeHub - Marketplace for Bicycles

A full-stack marketplace application for buying and selling bicycles, built with Next.js (Frontend) and Flask (Backend).

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.8+)
- PostgreSQL or SQLite

### Installation & Setup

#### Step 1: Install Backend Dependencies
```bash
cd Backend
npm run setup
```
This installs Python dependencies from `src/requirements.txt`.

#### Step 2: Install Frontend Dependencies
```bash
cd ../Frontend
npm install
```

### Running the Application

You need to run the **Backend** and **Frontend** in separate terminals:

#### Terminal 1 - Start Backend (Flask on port 9999)
```bash
cd Backend
python src/app.py
```

#### Terminal 2 - Start Frontend (Next.js on port 3000)
```bash
cd Frontend
npm run dev
```

Then open your browser and navigate to: **http://localhost:3000**

### Project Structure

```
bikehub/
├── Backend/
│   ├── src/
│   │   ├── api/              # API routes and controllers
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── schemas/
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   ├── domain/           # Domain models
│   │   ├── infrastructure/   # Database models and repositories
│   │   ├── services/         # Business logic services
│   │   ├── app.py            # Flask app entry point
│   │   ├── config.py         # Configuration
│   │   ├── create_app.py     # App factory
│   │   ├── requirements.txt  # Python dependencies
│   │   └── swagger_config.json
│   ├── package.json          # Scripts for setup
│   └── JWT_AUTH_GUIDE.md     # Authentication documentation
├── Frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── login/        # Login & Register page
│   │   │   ├── page.tsx      # Home page
│   │   │   ├── post/         # Post listing page
│   │   │   └── profile/      # User profile page
│   │   ├── components/       # Reusable React components
│   │   ├── assets/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   ├── public/               # Static assets
│   ├── package.json
│   ├── next.config.ts        # API proxy configuration
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── postcss.config.mjs
└── README.md
```

## 🔐 Authentication

The application uses **JWT (JSON Web Tokens)** for authentication:

- **Register**: Create account with email/phone + password (requires age 13+)
- **Login**: Login with email or phone + password
- **Tokens**: Access & refresh tokens stored in localStorage
- **Redirect**: After successful login, automatically redirected to home page

For detailed auth documentation, see [Backend/JWT_AUTH_GUIDE.md](Backend/JWT_AUTH_GUIDE.md).

## 📱 Features Implemented

- ✅ User Registration (email/phone validation)
- ✅ User Login with JWT tokens
- ✅ Real-time email/phone uniqueness checks
- ✅ Phone format validation (Vietnam: starts with 0, 10-11 digits)
- ✅ Age validation (minimum 13 years)
- ✅ User profile fields (full name, date of birth, avatar)
- ✅ Password hashing with bcrypt
- ✅ Auto-redirect to home after successful login

## 🔌 API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/check-uniqueness` - Check email/phone availability

## 🛠️ Tech Stack

**Backend:**
- Flask 3.1.3
- SQLAlchemy ORM
- Flask-JWT-Extended
- Bcrypt (password hashing)
- PostgreSQL/SQLite

**Frontend:**
- Next.js 16.2.1
- React 19.2.4
- TypeScript
- Tailwind CSS 4
- React Icons

## 📝 Notes

- Backend and Frontend run on **separate ports** (9999 and 3000)
- Frontend automatically proxies API calls from `/api/*` → `http://localhost:9999/api/*`
- Always start Backend before Frontend for the application to work correctly
- JWT tokens are stored in browser's localStorage after login
- `npm run clean` - Clean build artifacts and cache

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9999
- **API Documentation**: Available at backend server

## 🔧 Development Workflow

1. **First time install:**
   ```bash
   cd bikehub
   npm install
   cd Frontend && npm install
   cd ../Backend && npm run setup
   ```

2. **Daily development:**
   ```bash
   npm run dev
   ```

3. **Working on specific parts:**
   ```bash
   # Frontend only
   npm run frontend

   # Backend only
   npm run backend
   ```

## 📝 Notes

- Frontend automatically proxies API calls to backend
- Database configuration in `Backend/src/config.py`
- Environment variables in `.env` files
python .\seed_listings.py --count ?? (script post bike)