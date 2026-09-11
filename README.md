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

### Deploy the frontend on Vercel

For a separate Vercel frontend, import the GitHub repository into Vercel and set
the project root directory to `frontend`. Leave the framework preset as `Other`
and leave the build command empty. After the backend is deployed, replace the
empty `hiremeai-api-base-url` meta tag in `frontend/index.html` with the backend
URL, for example `https://hiremeai.onrender.com`.
