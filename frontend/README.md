# HisabVani Frontend

Next.js 16 frontend for the HisabVani multilingual household finance product.

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the public FastAPI origin in production. When it is
not set, `/api/*` requests use the local rewrite to
`BACKEND_URL` (default `http://127.0.0.1:8000`).

The user's household ledger is stored in versioned browser `localStorage`.
Voice expenses, scanned bills, and Sarvam 105B conversations share that ledger.
The report builder preselects the saved records and only sends the selected
subset to the backend.

## Commands

```bash
npm run lint
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
