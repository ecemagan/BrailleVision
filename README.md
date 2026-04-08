# Braille Vision Dashboard

This repository now includes a Next.js dashboard that uses Supabase Auth and Database to save Braille conversions.

## Dashboard setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.local.example .env.local
```

3. Add your Supabase project values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Run the SQL in `supabase/documents.sql` inside the Supabase SQL editor.

5. Start the dashboard:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Existing Python translator

The original Python translator is still available:

```bash
python3 main.py
```

## Python tests

```bash
python3 -m unittest -v test_pipeline.py
```
