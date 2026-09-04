-- Migration: Add bootstrap_account flag to prevent privilege escalation
-- This flag distinguishes operator-created bootstrap accounts from user-registered accounts

ALTER TABLE usuarios ADD COLUMN bootstrap_account TINYINT(1) NOT NULL DEFAULT 0;
