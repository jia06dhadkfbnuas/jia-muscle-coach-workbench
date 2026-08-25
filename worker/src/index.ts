interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
  READ_TOKEN: string;
  ALLOWED_ORIGIN: string;
  TIME_ZONE?: string;
}

type Sample = { qty?: number | string; date?: string; start?: string; startDate?: string; value?: string };
type Metric = { name?: string; data?: Sample[] };
type Workout = { start?: string; end?: string; duration?: number | string; avgHeartRate?: { qty?: number | string } };
type HealthPayload = { data?: { metrics?: Metric[]; workouts?: Workout[] } };
type Snapshot = { sleepHours?: number; restingHr?: number; hrvSdnn?: number; workoutDurationMin?: number; avgHr?: number };

const json = (body: unknown, status = 200, origin?: string) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", ...(origin ? cors(origin) : {}) },
});

const cors = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "vary": "Origin",
});

function authorized(request: Request, token: string) {
  return request.headers.get("authorization") === `Bearer ${token}`;
}

function sampleDate(sample: Sample) {
  return new Date(sample.date || sample.start || sample.startDate || 0).getTime();
}

function latestNumber(samples: Sample[]) {
  const latest = [...samples].sort((a, b) => sampleDate(b) - sampleDate(a))[0];
  const value = Number(latest?.qty);
  return Number.isFinite(value) ? value : undefined;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23" }).formatToParts(date);
  return Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
}

function sleepHours(samples: Sample[], timeZone: string) {
  const totals = new Map<string, number>();
  for (const sample of samples) {
    const duration = Number(sample.qty);
    const start = new Date(sample.start || sample.startDate || sample.date || 0);
    const state = sample.value || "";
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(start.getTime()) || /清醒|卧床|awake|in bed/i.test(state)) continue;
    const parts = localParts(start, timeZone);
    const night = Number(parts.hour) < 12 ? new Date(start.getTime() - 86_400_000) : start;
    const keyParts = localParts(night, timeZone);
    const key = `${keyParts.year}-${keyParts.month}-${keyParts.day}`;
    totals.set(key, (totals.get(key) || 0) + duration);
  }
  const latest = [...totals.entries()].sort(([a], [b]) => b.localeCompare(a))[0]?.[1];
  return latest === undefined ? undefined : Number(latest.toFixed(1));
}

function normalize(payload: HealthPayload, timeZone: string): Snapshot {
  const metrics = payload.data?.metrics || [];
  const samples = (name: string) => metrics.find((metric) => metric.name?.toLowerCase() === name)?.data || [];
  const workouts = [...(payload.data?.workouts || [])].sort((a, b) => new Date(b.end || b.start || 0).getTime() - new Date(a.end || a.start || 0).getTime());
  const workout = workouts[0];
  const durationSeconds = Number(workout?.duration);
  const avgHr = Number(workout?.avgHeartRate?.qty);
  return {
    sleepHours: sleepHours(samples("sleep_analysis"), timeZone),
    restingHr: latestNumber(samples("resting_heart_rate")),
    hrvSdnn: latestNumber(samples("heart_rate_variability")),
    workoutDurationMin: Number.isFinite(durationSeconds) ? Math.round(durationSeconds / 60) : undefined,
    avgHr: Number.isFinite(avgHr) ? Math.round(avgHr) : undefined,
  };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://jia06dhadkfbnuas.github.io";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(allowedOrigin) });
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") return json({ ok:true }, 200, allowedOrigin);

    if (url.pathname === "/v1/health" && request.method === "POST") {
      if (!authorized(request, env.INGEST_TOKEN)) return json({ error:"unauthorized" }, 401, origin === allowedOrigin ? allowedOrigin : undefined);
      let payload: HealthPayload;
      try { payload = await request.json() as HealthPayload; } catch { return json({ error:"invalid JSON" }, 400); }
      const snapshot = normalize(payload, env.TIME_ZONE || "Asia/Shanghai");
      if (!Object.values(snapshot).some((value) => value !== undefined)) return json({ error:"no supported health fields" }, 422);
      const now = new Date();
      const dateParts = localParts(now, env.TIME_ZONE || "Asia/Shanghai");
      const snapshotDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      const syncedAt = now.toISOString();
      await env.DB.prepare(`INSERT INTO recovery_snapshots (snapshot_date, sleep_hours, resting_hr, hrv_sdnn, workout_duration_min, avg_hr, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date) DO UPDATE SET
          sleep_hours=COALESCE(excluded.sleep_hours, recovery_snapshots.sleep_hours),
          resting_hr=COALESCE(excluded.resting_hr, recovery_snapshots.resting_hr),
          hrv_sdnn=COALESCE(excluded.hrv_sdnn, recovery_snapshots.hrv_sdnn),
          workout_duration_min=COALESCE(excluded.workout_duration_min, recovery_snapshots.workout_duration_min),
          avg_hr=COALESCE(excluded.avg_hr, recovery_snapshots.avg_hr),
          synced_at=excluded.synced_at`)
        .bind(snapshotDate, snapshot.sleepHours ?? null, snapshot.restingHr ?? null, snapshot.hrvSdnn ?? null, snapshot.workoutDurationMin ?? null, snapshot.avgHr ?? null, syncedAt).run();
      return json({ ok:true, snapshot:{ ...snapshot, syncedAt } });
    }

    if (url.pathname === "/v1/recovery/latest" && request.method === "GET") {
      if (origin && origin !== allowedOrigin) return json({ error:"origin not allowed" }, 403);
      if (!authorized(request, env.READ_TOKEN)) return json({ error:"unauthorized" }, 401, allowedOrigin);
      const row = await env.DB.prepare("SELECT sleep_hours, resting_hr, hrv_sdnn, workout_duration_min, avg_hr, synced_at FROM recovery_snapshots ORDER BY synced_at DESC LIMIT 1").first<Record<string, number | string | null>>();
      if (!row) return json({ snapshot:null }, 200, allowedOrigin);
      return json({ snapshot:{ sleepHours:row.sleep_hours, restingHr:row.resting_hr, hrvSdnn:row.hrv_sdnn, workoutDurationMin:row.workout_duration_min, avgHr:row.avg_hr, syncedAt:row.synced_at } }, 200, allowedOrigin);
    }

    return json({ error:"not found" }, 404, origin === allowedOrigin ? allowedOrigin : undefined);
  },
};

export default worker;
