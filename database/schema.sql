-- AgriMatch PostgreSQL schema, adapted from original config/db.php.
-- Run against a new Neon database. Re-running is safe; existing records are retained.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
 user_id BIGSERIAL PRIMARY KEY,
 role VARCHAR(12) NOT NULL CHECK (role IN ('farmer','buyer','admin')),
 full_name VARCHAR(150) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE,
 phone VARCHAR(30) NOT NULL,
 password VARCHAR(255) NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
CREATE TABLE IF NOT EXISTS farmer_details (
 farmer_id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
 location VARCHAR(150) NOT NULL,
 id_document TEXT, map_document TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS farmer_crops (
 crop_id BIGSERIAL PRIMARY KEY,
 farmer_id BIGINT NOT NULL REFERENCES farmer_details(farmer_id) ON DELETE CASCADE,
 crop_type VARCHAR(100) NOT NULL,
 UNIQUE (farmer_id, crop_type)
);
CREATE TABLE IF NOT EXISTS buyer_details (
 buyer_id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
 physical_address VARCHAR(255) NOT NULL,
 organization_type VARCHAR(40) NOT NULL CHECK (organization_type IN ('school','hotel','manufacturing_company','hospital','retailer','wholesaler','exporter','other')),
 business_certificate TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS produce_listings (
 listing_id BIGSERIAL PRIMARY KEY,
 farmer_id BIGINT NOT NULL REFERENCES farmer_details(farmer_id) ON DELETE CASCADE,
 crop_type VARCHAR(100) NOT NULL, variety VARCHAR(100),
 quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
 unit VARCHAR(20) NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','tonnes','bags_50kg','bags_90kg','crates')),
 price_per_unit NUMERIC(14,2) CHECK (price_per_unit >= 0),
 quality_grade VARCHAR(12) NOT NULL DEFAULT 'ungraded' CHECK (quality_grade IN ('grade_a','grade_b','grade_c','ungraded')),
 harvest_date DATE, available_from DATE NOT NULL, available_until DATE,
 location VARCHAR(150) NOT NULL, description TEXT, photo TEXT,
 status VARCHAR(12) NOT NULL DEFAULT 'available' CHECK (status IN ('available','matched','sold','withdrawn')),
 date_posted TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT valid_availability CHECK (available_until IS NULL OR available_until >= available_from)
);
CREATE TABLE IF NOT EXISTS demands (
 demand_id BIGSERIAL PRIMARY KEY,
 buyer_id BIGINT NOT NULL REFERENCES buyer_details(buyer_id) ON DELETE CASCADE,
 crop_type VARCHAR(100) NOT NULL,
 min_quantity NUMERIC(12,2) NOT NULL CHECK (min_quantity > 0),
 unit VARCHAR(20) NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','tonnes','bags_50kg','bags_90kg','crates')),
 preferred_quality VARCHAR(12) NOT NULL DEFAULT 'any' CHECK (preferred_quality IN ('grade_a','grade_b','grade_c','any')),
 max_price_per_unit NUMERIC(14,2) CHECK (max_price_per_unit >= 0),
 preferred_location VARCHAR(150) NOT NULL,
 needed_by DATE,
 frequency VARCHAR(12) NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time','weekly','monthly','ongoing')),
 description TEXT,
 status VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','fulfilled','closed')),
 date_posted TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS matches (
 match_id BIGSERIAL PRIMARY KEY,
 listing_id BIGINT NOT NULL REFERENCES produce_listings(listing_id) ON DELETE CASCADE,
 demand_id BIGINT NOT NULL REFERENCES demands(demand_id) ON DELETE CASCADE,
 requested_by VARCHAR(8) NOT NULL DEFAULT 'buyer' CHECK (requested_by IN ('buyer','farmer')),
 status VARCHAR(12) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected')),
 match_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (listing_id,demand_id)
);
-- An individual listing can only be accepted for one demand.
CREATE UNIQUE INDEX IF NOT EXISTS one_accepted_demand_per_listing ON matches(listing_id) WHERE status='accepted';
CREATE INDEX IF NOT EXISTS produce_by_crop_status ON produce_listings(crop_type,status);
CREATE INDEX IF NOT EXISTS demand_by_crop_status ON demands(crop_type,status);
CREATE INDEX IF NOT EXISTS match_by_demand_status ON matches(demand_id,status);
CREATE TABLE IF NOT EXISTS stored_files (
 id UUID PRIMARY KEY,
 owner_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('id_document','map_document','business_certificate','produce_photo')),
 original_name TEXT NOT NULL,
 mime_type VARCHAR(50) NOT NULL,
 bytes BYTEA NOT NULL,
 size_bytes INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stored_files_owner ON stored_files(owner_user_id);
COMMIT;
