-- Existing deployments may not have the uuid-ossp extension enabled, while
-- the already-installed registration function still references it. Enable it
-- for that function; fresh installs use gen_random_uuid() instead.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
