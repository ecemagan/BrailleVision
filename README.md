# Braille Vision Dashboard

This repository now includes a Next.js dashboard that uses Supabase Auth and Database to save Braille conversions.

Core product foundations now included:

- `profiles` table for display name, role, and workspace preferences
- richer `documents` metadata for source type, conversion mode, favorite state, and archive state
- bulk document management in the dashboard
- OCR support for images and camera input
- Word add-in history sync into the dashboard

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
   This step now creates both `profiles` and the expanded `documents` schema, so re-run it after pulling the latest changes.

5. Start the dashboard:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Word add-in with the new UI

Run the three services below together when testing the Word extension:

1. Next.js UI on port `3001`:

```bash
npm run dev:addin
```

2. Python backend on port `8000`:

```bash
python3 app.py
```

3. Word HTTPS gateway on port `3000`:

```bash
cd word-addin
npm install
npm start
```

The Word manifest still uses the same sideload flow, but it now opens `https://localhost:3000/word`, which proxies the UI from Next.js and the API calls from the Python backend.

## Existing Python translator

The original Python translator is still available:

```bash
python3 main.py
```

## Python tests

```bash
python3 -m unittest -v test_pipeline.py
```
<<<<<<< Updated upstream
=======

## Full project runbook

Use this section when you want the dashboard, Python translator backend, and the Word extension to work together with the latest UI.

### 1. Install project dependencies

```bash
cd /Users/durukula/Documents/GitHub/BrailleVision
npm install
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### 2. Make sure Supabase is configured

Create `.env.local` if it does not exist yet:

```bash
cp .env.local.example .env.local
```

Then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

`GEMINI_API_KEY` is optional for the rest of the app, but it enables the higher-quality `AI Vision` mode in Graph Reader. Without it, Graph Reader falls back to `Offline Basic`.

Re-run the SQL after the latest schema changes:

```text
Open supabase/documents.sql in the Supabase SQL Editor and run it again.
```

### 3. Start the dashboard only

If you only want the web dashboard:

```bash
cd /Users/durukula/Documents/GitHub/BrailleVision
npm run dev
```

Open:

```text
http://localhost:3000
```

### 4. Start the full stack with Word extension

You need 3 terminals.

Terminal 1: Next UI for the Word add-in

```bash
cd /Users/durukula/Documents/GitHub/BrailleVision
npm run dev:addin
```

This serves the modern add-in UI at:

```text
http://localhost:3001/word
```

Terminal 2: Python translator backend

```bash
cd /Users/durukula/Documents/GitHub/BrailleVision
source .venv/bin/activate
python app.py
```

This serves the translation backend at:

```text
http://localhost:8000
```

Terminal 3: Word HTTPS gateway

```bash
cd /Users/durukula/Documents/GitHub/BrailleVision/word-addin
npm install
npm start
```

This serves the sideloaded Word add-in host at:

```text
https://localhost:3000/word
```

### 5. Re-copy the Word manifest after updates

If the manifest changed, copy it again:

```bash
mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
cp /Users/durukula/Documents/GitHub/BrailleVision/word-addin/manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/
```

Then fully close and reopen Microsoft Word.

### 6. Sign in before using history sync

If you want Word extension conversions to appear in the dashboard history:

1. Open `https://localhost:3000/login`
2. Sign in with the same Supabase user you use in the dashboard
3. Open the Word add-in and run conversions

The add-in will then save records into the same `documents` table.

### 7. Important port rules

- `3000` is reserved for the Word HTTPS gateway when testing the extension
- `3001` is reserved for the new Next.js add-in UI
- `8000` is reserved for the Python backend

Do not run `npm run dev` on `3000` at the same time as `word-addin/npm start`.

### 8. Typical daily startup sequence

If you want everything running:

```bash
# Terminal 1
cd /Users/durukula/Documents/GitHub/BrailleVision
npm run dev:addin
```

```bash
# Terminal 2
cd /Users/durukula/Documents/GitHub/BrailleVision
source .venv/bin/activate
python app.py
```

```bash
# Terminal 3
cd /Users/durukula/Documents/GitHub/BrailleVision/word-addin
npm start
```

Then:

1. Open `https://localhost:3000/login`
2. Sign in
3. Open Microsoft Word
4. Launch the Braille Vision add-in

### 9. Quick troubleshooting

- If dashboard actions fail:
  Re-run `supabase/documents.sql`
- If `fastapi` is missing:
  Use `.venv` and run `python -m pip install -r requirements.txt`
- If `https://localhost:3000` does not open:
  Make sure `word-addin/npm start` is running and port `3000` is free
- If Word add-in opens but translation fails:
  Make sure `python app.py` is running on `8000`
>>>>>>> Stashed changes
