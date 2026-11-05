CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trial_until TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer TEXT,
  stripe_subscription TEXT,
  connected_account TEXT,
  created TEXT NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL
);
CREATE TABLE memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','manager','receptionist','housekeeper')),
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  csrf TEXT NOT NULL,
  expires TEXT NOT NULL
);
CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id TEXT,
  organization_id TEXT,
  email TEXT NOT NULL,
  role TEXT,
  expires TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE email_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created TEXT NOT NULL
);
CREATE TABLE checkout_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  reservation_id TEXT,
  kind TEXT NOT NULL,
  plan TEXT,
  amount INTEGER NOT NULL,
  stripe_account TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_url TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE TABLE webhook_events (id TEXT PRIMARY KEY, created TEXT NOT NULL);
CREATE TABLE property_settings (
  property_id TEXT PRIMARY KEY REFERENCES properties(id),
  public_slug TEXT NOT NULL UNIQUE,
  published INTEGER NOT NULL DEFAULT 0,
  policy TEXT NOT NULL DEFAULT 'Kontaktoni pronën për kushtet e anulimit dhe pagesës.',
  housekeeping_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE room_assignments (
  room_id TEXT PRIMARY KEY REFERENCES rooms(id),
  user_id TEXT REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL
);
CREATE INDEX email_pending ON email_jobs(status,next_attempt);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE INDEX token_email ON tokens(email,kind);
