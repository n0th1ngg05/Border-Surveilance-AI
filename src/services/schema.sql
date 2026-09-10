-- Schema for border-surveilance database (SIH-26187)

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CAMERAS
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    rtsp_url TEXT NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    zone_id UUID,
    status VARCHAR(20) DEFAULT 'inactive',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VIRTUAL FENCE ZONES
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'RED', 'AMBER', 'GREEN', 'CORRIDOR'
    polygon JSONB NOT NULL,
    dwell_threshold_seconds INT DEFAULT 30,
    active_from TIMESTAMPTZ,
    active_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PERSONNEL
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    rank VARCHAR(50) NOT NULL,
    unit VARCHAR(100) NOT NULL,
    assigned_zone_id UUID,
    face_embedding_path TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MILITARY VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL, -- 'Combat', 'Transport', 'Patrol'
    classification VARCHAR(100) NOT NULL,
    unit VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI DETECTION EVENTS
CREATE TABLE IF NOT EXISTS ai_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id VARCHAR(100) NOT NULL,
    frame_index BIGINT NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    pipeline_module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    confidence REAL NOT NULL,
    zone_id VARCHAR(100),
    alert_level VARCHAR(20) DEFAULT 'INFO',
    verified BOOLEAN DEFAULT FALSE,
    snapshot_path TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY,
    event_id UUID,
    level VARCHAR(20) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW', 'INFO'
    message TEXT NOT NULL,
    camera_id VARCHAR(100) NOT NULL,
    zone_id VARCHAR(100),
    entity_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'acknowledged', 'dismissed'
    acknowledged_by VARCHAR(100),
    snapshot_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USERS (Operators / Admins)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'operator',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
