CREATE TABLE IF NOT EXISTS recovery_snapshots (
  snapshot_date TEXT PRIMARY KEY,
  sleep_hours REAL,
  sleep_start TEXT,
  sleep_end TEXT,
  resting_hr REAL,
  hrv_sdnn REAL,
  steps INTEGER,
  active_energy_kcal REAL,
  exercise_minutes REAL,
  body_weight_kg REAL,
  workout_duration_min REAL,
  avg_hr REAL,
  max_hr REAL,
  workout_energy_kcal REAL,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  workout_id TEXT PRIMARY KEY,
  workout_name TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  duration_min REAL,
  avg_hr REAL,
  max_hr REAL,
  energy_kcal REAL,
  synced_at TEXT NOT NULL
);
