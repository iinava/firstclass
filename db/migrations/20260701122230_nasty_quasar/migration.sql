CREATE TYPE "role" AS ENUM('superadmin', 'admin', 'staff');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'staff'::"role" NOT NULL,
	"email" text UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
