CREATE TABLE IF NOT EXISTS recovery_snapshots (
  snapshot_date TEXT PRIMARY KEY,
  sleep_hours REAL,
  resting_hr REAL,
  hrv_sdnn REAL,
  workout_duration_min REAL,
  avg_hr REAL,
  synced_at TEXT NOT NULL
);
