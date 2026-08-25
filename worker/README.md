# Private Apple Health sync

This Cloudflare Worker accepts Health Auto Export REST API automations and retains only sleep duration, resting heart rate, HRV SDNN, recent workout duration, and average heart rate.

It never stores the original Health Auto Export JSON, routes, ECG, symptoms, or medical records.

## Deploy

1. Sign in to Cloudflare and create a D1 database named `jia-muscle-coach`.
2. Put its database ID in `wrangler.toml`.
3. In this directory run `npm install`, `npx wrangler login`, `npm run db:apply`, then `npm run deploy`.
4. Set Worker secrets: `INGEST_TOKEN` and `READ_TOKEN` must be different random strings. Set `ALLOWED_ORIGIN` to `https://jia06dhadkfbnuas.github.io`.
5. In Health Auto Export create two REST API automations to `https://YOUR_WORKER.workers.dev/v1/health`, both with header `Authorization: Bearer INGEST_TOKEN`:
   - Health Metrics: sleep analysis, resting heart rate, heart rate variability; JSON v2; no ECG, symptoms, routes, or basal energy.
   - Workouts: strength workouts and workout metrics; JSON v2; no routes.
6. Add the Worker URL and `READ_TOKEN` under “设置私有自动同步” in the workbench. The “立即同步 Health” button verifies the connection; subsequent visits can use it without files.

Health Auto Export REST automations require the app's automation capability and may require a paid tier or trial. iOS can defer background execution, so “automatic” means sync at the app's selected cadence, not a guaranteed minute-level delivery.
