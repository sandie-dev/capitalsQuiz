# Capital City Quiz 

Express + EJS + Neon PostgreSQL quiz, prepared for local development and Netlify Functions.

## Requirements
- Node.js 22
- A Neon PostgreSQL database with `public.capitals` containing `id`, `country`, and `capital`

## Local setup
1. Open this project folder in a terminal.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your Neon connection string in `PG_DATABASE_URL` and a long random value in `SESSION_SECRET`.
5. Keep `NODE_ENV=development` locally.
6. Run `npm start` and open `http://localhost:3000`.

Do not commit `.env` or share the connection string.

## Netlify setup
- Build command: `echo Building Capital City Quiz` (also configured in `netlify.toml`)
- Publish directory: `public` (also configured in `netlify.toml`)
- Add environment variables in Netlify:
  - `PG_DATABASE_URL`: the Neon connection string for the `worldQuiz` database, including `?sslmode=require`.
  - `SESSION_SECRET`: a long, random secret value.
  - `NODE_ENV`: `production` (do not mark this variable as a secret).
- Deploy the repository. The Netlify function and redirects are configured in `netlify.toml`.

The app uses a PostgreSQL connection pool. Player score and current question are kept in a signed cookie so different players do not share a global score.
