CREATE TABLE "booking_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"stay_note" text,
	"breakfast" boolean DEFAULT false NOT NULL,
	"lunch" boolean DEFAULT false NOT NULL,
	"dinner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "mileage_kmpl" numeric;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "fuel_price_per_litre" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_days_unique" ON "booking_days" ("booking_id","day_number");--> statement-breakpoint
CREATE INDEX "booking_days_booking_idx" ON "booking_days" ("booking_id");--> statement-breakpoint
CREATE INDEX "lead_destinations_lead_idx" ON "lead_destinations" ("lead_id","sort_order");--> statement-breakpoint
ALTER TABLE "booking_days" ADD CONSTRAINT "booking_days_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_destinations" ADD CONSTRAINT "lead_destinations_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;