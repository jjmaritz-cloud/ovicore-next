-- OviCore Farm and Shed setup expansion
-- PostgreSQL / Render database
-- Safe to run more than once.

ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS common_name TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS farm_manager TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS suburb TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS postcode VARCHAR(20);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS country VARCHAR(80);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS time_zone VARCHAR(100);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS total_bird_capacity INTEGER;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS licensed_bird_capacity INTEGER;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS water_source TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS water_storage_litres INTEGER;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS power_supply TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS backup_generator BOOLEAN;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS generator_capacity_kva NUMERIC(10,2);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS feed_delivery_access TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS truck_restrictions TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS biosecurity_classification VARCHAR(80);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS shower_in_shower_out BOOLEAN;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS visitor_approval_required BOOLEAN;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS mortality_disposal_method TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS manure_disposal_method TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS environmental_licence_number TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS free_range_area_ha NUMERIC(10,2);
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE broiler_farms ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS shed_type VARCHAR(80);
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS housing_system VARCHAR(80);
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS capacity_birds INTEGER;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS length_m NUMERIC(10,2);
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS width_m NUMERIC(10,2);
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS number_of_levels INTEGER;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS number_of_sections INTEGER;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS ventilation_type TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS cooling_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS heating_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS lighting_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS water_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS feeder_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS nest_type TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS egg_collection_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS manure_system TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS year_commissioned INTEGER;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS male_female_support VARCHAR(80);
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS environmental_controller TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS controller_id TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS water_meter_id TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS power_meter_id TEXT;
ALTER TABLE broiler_sheds ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE broiler_farms
SET country = COALESCE(country, 'Australia'),
    time_zone = COALESCE(time_zone, 'Australia/Sydney')
WHERE country IS NULL OR time_zone IS NULL;

UPDATE broiler_sheds
SET shed_type = COALESCE(shed_type, 'Broiler')
WHERE shed_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_broiler_farm_code_idx
ON broiler_farms(company_id, farm_code)
WHERE farm_code IS NOT NULL AND farm_code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_shed_code_idx
ON broiler_sheds(farm_id, shed_code)
WHERE shed_code IS NOT NULL AND shed_code <> '';
