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

## Local FFmpeg + Whisper.cpp

This project can use the vendored FFmpeg and whisper.cpp submodules for local processing.

1) Initialize submodules:
```bash
npm run submodules:init
```

2) Build FFmpeg (optional):
```bash
npm run ffmpeg:build
```

3) Build Whisper.cpp and download a model (optional):
```bash
npm run whisper:build -- base.en
```

4) Set environment variables in .env.local:
```
FFMPEG_BIN=./vendor/ffmpeg/build/bin/ffmpeg
WHISPER_CPP_BIN=./vendor/whisper.cpp/main
WHISPER_CPP_MODEL=./vendor/whisper.cpp/models/ggml-base.en.bin
```

If these variables are not set, the app falls back to ffmpeg-static and OpenAI Whisper API.

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

## Sources

Video clips (free/public domain where noted):
- Pexels Videos: https://www.pexels.com/videos/
- Pixabay Videos: https://pixabay.com/videos/
- Videvo: https://www.videvo.net
- Videezy: https://www.videezy.com
- Internet Archive / Prelinger Archives: https://archive.org/details/prelinger
- NASA Media Library: https://images.nasa.gov
- Pond5 Public Domain Project: https://www.pond5.com/free
- U.S. National Archives (NARA): https://catalog.archives.gov/
- DVIDS (DoD Visual Info): https://www.dvidshub.net/
- National Park Service Multimedia: https://www.nps.gov/media/
- C-SPAN Video Library: https://www.c-span.org/

Newspaper clippings and archival images:
- Chronicling America (LOC): https://chroniclingamerica.loc.gov
- Library of Congress Free to Use: https://www.loc.gov/free-to-use/
- Rawpixel Public Domain: https://www.rawpixel.com/category/53/public-domain
- Internet Archive Newspaper Collections: https://archive.org/search?query=newspaper+clippings
- Europeana Newspapers: https://newspapers.europeana.eu
- Smithsonian Open Access: https://www.si.edu/openaccess
- NYPL Digital Collections: https://digitalcollections.nypl.org/
- Public Domain Review (curated): https://publicdomainreview.org/
- Europeana Collections: https://www.europeana.eu/en/collections

Optional audio beds (check license per asset):
- Free Music Archive: https://freemusicarchive.org/
- Incompetech: https://incompetech.com/music/
- YouTube Audio Library: https://www.youtube.com/audiolibrary

Machine-readable list for the pipeline is in data/sources.json.

## Pipeline Intelligence

Configuration and templates live in src/intelligence:
- contentCriteria.ts
- analysisPrompt.ts
- curationRules.ts
- platformSpecs.ts
- captionTemplates.ts
- contentCalendar.ts

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
