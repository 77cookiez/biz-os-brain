-- Add 'deprecated' to app_status enum
ALTER TYPE app_status ADD VALUE IF NOT EXISTS 'deprecated';