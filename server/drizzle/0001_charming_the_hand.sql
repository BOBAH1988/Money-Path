ALTER TABLE "profiles" ADD COLUMN "accepted_terms_version" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "accepted_privacy_version" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "consent_updated_at" timestamp with time zone;