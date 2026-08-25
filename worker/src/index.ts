interface Env { DB: D1Database; INGEST_TOKEN: string; READ_TOKEN: string; ALLOWED_ORIGIN: string; TIME_ZONE?: string; }
type Sample = { qty?: number | string; date?: string; start?: string; startDate?: string; end?: string; endDate?: string; value?: string };
type Metric = { name?: string; data?: Sample[] };
type Workout = { name?: string; start?: string; end?: string; duration?: number | string; avgHeartRate?: { qty?: number | string }; maxHeartRate?: { qty?: number | string }; activeEnergyBurned?: { qty?: number | string }; totalEnergyBurned?: { qty?: number | string } };
type HealthPayload = { data?: { metrics?: Metric[]; workouts?: Workout[] } };
type Snapshot = { sleepHours?: number; sleepStart?: string; sleepEnd?: string; restingHr?: number; hrvSdnn?: number; steps?: number; activeEnergyKcal?: number; exerciseMinutes?: number; bodyWeightKg?: number; workoutDurationMin?: number; avgHr?: number; maxHr?: number; workoutEnergyKcal?: number };

const cors = (origin: string) => ({ "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS", vary: "Origin" });
const json = (body: unknown, status = 200, origin?: string) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...(origin ? cors(origin) : {}) } });
const number = (value: unknown) => { const result = Number(value); return Number.isFinite(result) ? result : undefined; };
const nameOf = (name?: string) => (name || "").toLowerCase().replace(/[\s-]+/g, "_");
const sampleDate = (sample: Sample) => new Date(sample.date || sample.start || sample.startDate || 0).getTime();

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23" }).formatToParts(date);
  return Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
}
function samplesFor(metrics: Metric[], names: string[]) { const aliases = new Set(names.map(nameOf)); return metrics.filter((metric) => aliases.has(nameOf(metric.name))).flatMap((metric) => metric.data || []); }
function latest(samples: Sample[]) { const sample = [...samples].sort((a, b) => sampleDate(b) - sampleDate(a))[0]; return number(sample?.qty); }
function sum(samples: Sample[]) { const values = samples.map((sample) => number(sample.qty)).filter((value): value is number => value !== undefined); return values.length ? values.reduce((total, value) => total + value, 0) : undefined; }

function sleep(samples: Sample[], timeZone: string): Pick<Snapshot, "sleepHours" | "sleepStart" | "sleepEnd"> {
  const nights = new Map<string, { hours:number; start:Date; end:Date }>();
  for (const sample of samples) {
    const hours = number(sample.qty); const start = new Date(sample.start || sample.startDate || sample.date || 0); const state = sample.value || "";
    if (!hours || hours <= 0 || !Number.isFinite(start.getTime()) || /清醒|卧床|awake|in bed/i.test(state)) continue;
    const end = new Date(sample.end || sample.endDate || start.getTime() + hours * 3_600_000); const parts = localParts(start, timeZone);
    const night = Number(parts.hour) < 12 ? new Date(start.getTime() - 86_400_000) : start; const keyParts = localParts(night, timeZone); const key = `${keyParts.year}-${keyParts.month}-${keyParts.day}`;
    const current = nights.get(key); nights.set(key, current ? { hours:current.hours + hours, start:current.start < start ? current.start : start, end:current.end > end ? current.end : end } : { hours, start, end });
  }
  const latestNight = [...nights.entries()].sort(([a], [b]) => b.localeCompare(a))[0]?.[1];
  return latestNight ? { sleepHours:Number(latestNight.hours.toFixed(1)), sleepStart:latestNight.start.toISOString(), sleepEnd:latestNight.end.toISOString() } : {};
}

function normalize(payload: HealthPayload, timeZone: string): Snapshot {
  const metrics = payload.data?.metrics || []; const find = (...names: string[]) => samplesFor(metrics, names);
  const workout = [...(payload.data?.workouts || [])].sort((a, b) => new Date(b.end || b.start || 0).getTime() - new Date(a.end || a.start || 0).getTime())[0];
  const durationSeconds = number(workout?.duration);
  return {
    ...sleep(find("sleep_analysis"), timeZone), restingHr:latest(find("resting_heart_rate")), hrvSdnn:latest(find("heart_rate_variability")),
    steps:sum(find("step_count", "steps")), activeEnergyKcal:sum(find("active_energy_burned", "active_energy")), exerciseMinutes:sum(find("apple_exercise_time", "exercise_time")), bodyWeightKg:latest(find("body_mass", "body_weight")),
    workoutDurationMin:durationSeconds === undefined ? undefined : Math.round(durationSeconds / 60), avgHr:number(workout?.avgHeartRate?.qty), maxHr:number(workout?.maxHeartRate?.qty), workoutEnergyKcal:number(workout?.activeEnergyBurned?.qty) ?? number(workout?.totalEnergyBurned?.qty),
  };
}

async function storeWorkouts(db: D1Database, workouts: Workout[], syncedAt: string) {
  for (const workout of workouts) {
    const start = workout.start || ""; const end = workout.end || ""; if (!start && !end) continue;
    const duration = number(workout.duration); const id = encodeURIComponent(`${start}|${end}|${workout.name || "Workout"}|${duration || ""}`);
    await db.prepare(`INSERT INTO workout_sessions (workout_id, workout_name, start_at, end_at, duration_min, avg_hr, max_hr, energy_kcal, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workout_id) DO UPDATE SET avg_hr=excluded.avg_hr, max_hr=excluded.max_hr, energy_kcal=excluded.energy_kcal, synced_at=excluded.synced_at`)
      .bind(id, workout.name || "Workout", start || null, end || null, duration === undefined ? null : duration / 60, number(workout.avgHeartRate?.qty) ?? null, number(workout.maxHeartRate?.qty) ?? null, number(workout.activeEnergyBurned?.qty) ?? number(workout.totalEnergyBurned?.qty) ?? null, syncedAt).run();
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin"); const allowedOrigin = env.ALLOWED_ORIGIN || "https://jia06dhadkfbnuas.github.io"; const timeZone = env.TIME_ZONE || "Asia/Shanghai";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(allowedOrigin) });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok:true }, 200, allowedOrigin);
    if (url.pathname === "/v1/health" && request.method === "POST") {
      if (request.headers.get("authorization") !== `Bearer ${env.INGEST_TOKEN}`) return json({ error:"unauthorized" }, 401);
      let payload: HealthPayload; try { payload = await request.json() as HealthPayload; } catch { return json({ error:"invalid JSON" }, 400); }
      const snapshot = normalize(payload, timeZone); if (!Object.values(snapshot).some((value) => value !== undefined)) return json({ error:"no supported health fields" }, 422);
      const now = new Date(); const parts = localParts(now, timeZone); const snapshotDate = `${parts.year}-${parts.month}-${parts.day}`; const syncedAt = now.toISOString();
      await env.DB.prepare(`INSERT INTO recovery_snapshots (snapshot_date, sleep_hours, sleep_start, sleep_end, resting_hr, hrv_sdnn, steps, active_energy_kcal, exercise_minutes, body_weight_kg, workout_duration_min, avg_hr, max_hr, workout_energy_kcal, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(snapshot_date) DO UPDATE SET sleep_hours=COALESCE(excluded.sleep_hours, recovery_snapshots.sleep_hours), sleep_start=COALESCE(excluded.sleep_start, recovery_snapshots.sleep_start), sleep_end=COALESCE(excluded.sleep_end, recovery_snapshots.sleep_end), resting_hr=COALESCE(excluded.resting_hr, recovery_snapshots.resting_hr), hrv_sdnn=COALESCE(excluded.hrv_sdnn, recovery_snapshots.hrv_sdnn), steps=COALESCE(excluded.steps, recovery_snapshots.steps), active_energy_kcal=COALESCE(excluded.active_energy_kcal, recovery_snapshots.active_energy_kcal), exercise_minutes=COALESCE(excluded.exercise_minutes, recovery_snapshots.exercise_minutes), body_weight_kg=COALESCE(excluded.body_weight_kg, recovery_snapshots.body_weight_kg), workout_duration_min=COALESCE(excluded.workout_duration_min, recovery_snapshots.workout_duration_min), avg_hr=COALESCE(excluded.avg_hr, recovery_snapshots.avg_hr), max_hr=COALESCE(excluded.max_hr, recovery_snapshots.max_hr), workout_energy_kcal=COALESCE(excluded.workout_energy_kcal, recovery_snapshots.workout_energy_kcal), synced_at=excluded.synced_at`)
        .bind(snapshotDate, snapshot.sleepHours ?? null, snapshot.sleepStart ?? null, snapshot.sleepEnd ?? null, snapshot.restingHr ?? null, snapshot.hrvSdnn ?? null, snapshot.steps ?? null, snapshot.activeEnergyKcal ?? null, snapshot.exerciseMinutes ?? null, snapshot.bodyWeightKg ?? null, snapshot.workoutDurationMin ?? null, snapshot.avgHr ?? null, snapshot.maxHr ?? null, snapshot.workoutEnergyKcal ?? null, syncedAt).run();
      await storeWorkouts(env.DB, payload.data?.workouts || [], syncedAt); return json({ ok:true, snapshot:{ ...snapshot, syncedAt } });
    }
    if (url.pathname === "/v1/recovery/latest" && request.method === "GET") {
      if (origin && origin !== allowedOrigin) return json({ error:"origin not allowed" }, 403);
      if (request.headers.get("authorization") !== `Bearer ${env.READ_TOKEN}`) return json({ error:"unauthorized" }, 401, allowedOrigin);
      const row = await env.DB.prepare(`SELECT sleep_hours, sleep_start, sleep_end, resting_hr, hrv_sdnn, steps, active_energy_kcal, exercise_minutes, body_weight_kg, workout_duration_min, avg_hr, max_hr, workout_energy_kcal, synced_at FROM recovery_snapshots ORDER BY synced_at DESC LIMIT 1`).first<Record<string, number | string | null>>();
      if (!row) return json({ snapshot:null }, 200, allowedOrigin);
      return json({ snapshot:{ sleepHours:row.sleep_hours, sleepStart:row.sleep_start, sleepEnd:row.sleep_end, restingHr:row.resting_hr, hrvSdnn:row.hrv_sdnn, steps:row.steps, activeEnergyKcal:row.active_energy_kcal, exerciseMinutes:row.exercise_minutes, bodyWeightKg:row.body_weight_kg, workoutDurationMin:row.workout_duration_min, avgHr:row.avg_hr, maxHr:row.max_hr, workoutEnergyKcal:row.workout_energy_kcal, syncedAt:row.synced_at } }, 200, allowedOrigin);
    }
    return json({ error:"not found" }, 404);
  },
};
export default worker;
