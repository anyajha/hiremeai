## HireMeAI

HireMeAI is a FastAPI chat application that answers questions using the resume in
`A_Ress.pdf`. The backend serves the frontend from the same origin.

### Local run

Install the project dependencies, set `GROQ_API_KEY` in `.env`, then run:

```powershell
uvicorn backend.main:app --reload
```

Open `http://127.0.0.1:8000` in a browser.

### Deploy on Render

This repository includes `render.yaml` for a single Render web service. Create a
new Blueprint from the repository, then add the `GROQ_API_KEY` secret when Render
asks for it. Render will run the FastAPI app and serve the frontend at the same URL.

### Deploy the frontend on Netlify

Import this repository into Netlify. Netlify reads `netlify.toml` and publishes
the `frontend` directory. The FastAPI backend should remain deployed on Render.

After Render gives you the backend URL, replace the empty API meta tag in
`frontend/index.html` with that URL:

```html
<meta name="hiremeai-api-base-url" content="https://your-service.onrender.com" />
```

Commit and push that change, then trigger a new Netlify deploy. Do not put
`GROQ_API_KEY` in Netlify; it belongs only in the Render service environment.
