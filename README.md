# Why It Matters App

A modern web application for generating and auto-posting Quiet Hours content, built with Next.js and ready for Vercel deployment.

## Features

- 🚀 Built with Next.js 14 and TypeScript
- 📦 Optimized for Vercel deployment
- 🎨 Modern UI with responsive design
- 🔒 Type-safe with full TypeScript support
- ⚡ Fast and performant
- 🛠️ API routes ready for backend integration

## Prerequisites

- Node.js 18+ 
- npm or yarn package manager

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment variables:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your configuration:
```
NEXTAUTH_URL=http://localhost:3000
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

### Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

### Linting

Check code quality:

```bash
npm run lint
```

## Project Structure

```
why-it-matters-app/
├── app/
│   ├── api/              # API routes
│   │   └── health/       # Health check endpoint
│   ├── styles/           # Global styles
│   │   └── globals.css
│   ├── layout.tsx        # Root layout component
│   └── page.tsx          # Home page
├── public/               # Static assets
├── .env.local.example    # Environment variables template
├── .eslintrc.json        # ESLint configuration
├── next.config.js        # Next.js configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── vercel.json           # Vercel deployment config
```

## API Routes

- `GET /api/health` - Health check endpoint

## Deploying to Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

### Option 2: Connect Git Repository

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your repository
5. Vercel will automatically detect Next.js and deploy

### Option 3: Manual Deployment

1. Build the project: `npm run build`
2. Deploy the `.next` folder and `public` folder to your Vercel project

## Environment Variables for Vercel

Add these in your Vercel project settings:

- `NEXTAUTH_URL` - Your production URL

## Performance

This template comes optimized for:
- Core Web Vitals
- Next.js Image Optimization
- Automatic API Route Compression
- Code Splitting

## License

MIT
