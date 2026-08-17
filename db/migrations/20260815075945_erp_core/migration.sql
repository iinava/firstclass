CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "payment_mode" AS ENUM('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other');--> statement-breakpoint
CREATE TYPE "booking_status" AS ENUM('confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "lead_source" AS ENUM('walk_in', 'phone', 'referral', 'instagram', 'whatsapp', 'facebook', 'website', 'repeat', 'other');--> statement-breakpoint
CREATE TYPE "attendance_status" AS ENUM('present', 'absent', 'half_day', 'leave', 'holiday', 'week_off');--> statement-breakpoint
CREATE TYPE "employee_status" AS ENUM('active', 'on_leave', 'resigned', 'terminated');--> statement-breakpoint
CREATE TYPE "leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "leave_type" AS ENUM('casual', 'sick', 'paid', 'unpaid', 'comp_off');--> statement-breakpoint
CREATE TYPE "itinerary_kind" AS ENUM('package', 'custom');--> statement-breakpoint
CREATE TYPE "itinerary_status" AS ENUM('draft', 'published', 'sent', 'accepted', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "pricing_mode" AS ENUM('per_pax', 'fixed');--> statement-breakpoint
CREATE TYPE "followup_channel" AS ENUM('call', 'whatsapp', 'email', 'visit', 'other');--> statement-breakpoint
CREATE TYPE "followup_status" AS ENUM('pending', 'done', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "lead_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "lead_status" AS ENUM('new', 'contacted', 'quoted', 'negotiating', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "supplier_type" AS ENUM('hotel', 'homestay', 'resort', 'transport', 'guide', 'activity', 'restaurant', 'airline', 'agent', 'other');--> statement-breakpoint
CREATE TYPE "cost_category" AS ENUM('hotel', 'transport', 'flight', 'train', 'guide', 'activity', 'meal', 'permit', 'driver_allowance', 'fuel', 'toll_parking', 'misc');--> statement-breakpoint
CREATE TYPE "cost_status" AS ENUM('planned', 'booked', 'cancelled');--> statement-breakpoint
CREATE TYPE "payable_status" AS ENUM('unpaid', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "ownership" AS ENUM('owned', 'hired');--> statement-breakpoint
CREATE TYPE "vehicle_type" AS ENUM('hatchback', 'sedan', 'suv', 'tempo_traveller', 'mini_bus', 'bus', 'bike', 'other');--> statement-breakpoint
ALTER TYPE "role" ADD VALUE 'manager';--> statement-breakpoint
ALTER TYPE "role" ADD VALUE 'accounts';--> statement-breakpoint
ALTER TYPE "role" ADD VALUE 'sales';--> statement-breakpoint
ALTER TYPE "role" ADD VALUE 'ops';--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"is_trip_related" boolean DEFAULT true NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" text NOT NULL,
	"booking_id" uuid,
	"vehicle_id" uuid,
	"category_id" uuid,
	"description" text NOT NULL,
	"amount" bigint NOT NULL,
	"spent_at" date NOT NULL,
	"mode" "payment_mode" DEFAULT 'cash'::"payment_mode" NOT NULL,
	"bill_url" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'draft'::"invoice_status" NOT NULL,
	"notes" text,
	"terms" text,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"mode" "payment_mode" DEFAULT 'cash'::"payment_mode" NOT NULL,
	"reference" text,
	"received_at" date NOT NULL,
	"is_advance" boolean DEFAULT false NOT NULL,
	"notes" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"received_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"booking_id" uuid,
	"trip_cost_item_id" uuid,
	"amount" bigint NOT NULL,
	"mode" "payment_mode" DEFAULT 'bank_transfer'::"payment_mode" NOT NULL,
	"reference" text,
	"paid_at" date NOT NULL,
	"notes" text,
	"voided_at" timestamp with time zone,
	"paid_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_pax" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"name" text NOT NULL,
	"age" integer,
	"gender" text,
	"phone" text,
	"id_type" text,
	"id_number" text,
	"is_lead" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"lead_id" uuid,
	"itinerary_id" uuid,
	"title" text NOT NULL,
	"destination" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"pricing_mode" "pricing_mode" DEFAULT 'fixed'::"pricing_mode" NOT NULL,
	"price_per_adult" bigint,
	"price_per_child" bigint,
	"sell_subtotal" bigint DEFAULT 0 NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed'::"booking_status" NOT NULL,
	"assigned_to" uuid,
	"notes" text,
	"internal_notes" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancellation_charge" bigint,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"alt_phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"source" "lead_source" DEFAULT 'walk_in'::"lead_source" NOT NULL,
	"gstin" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" DEFAULT 'present'::"attendance_status" NOT NULL,
	"check_in" time,
	"check_out" time,
	"worked_minutes" integer,
	"notes" text,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"emp_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"designation" text,
	"department" text,
	"date_of_joining" date,
	"date_of_birth" date,
	"address" text,
	"monthly_salary" bigint,
	"emergency_contact" text,
	"status" "employee_status" DEFAULT 'active'::"employee_status" NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_id" uuid NOT NULL,
	"type" "leave_type" DEFAULT 'casual'::"leave_type" NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'pending'::"leave_status" NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itineraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"kind" "itinerary_kind" DEFAULT 'custom'::"itinerary_kind" NOT NULL,
	"title" text NOT NULL,
	"share_token" text NOT NULL,
	"is_share_enabled" boolean DEFAULT true NOT NULL,
	"lead_id" uuid,
	"customer_id" uuid,
	"source_package_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_itinerary_id" uuid,
	"destination" text,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"duration_nights" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"cover_image_url" text,
	"pricing_mode" "pricing_mode" DEFAULT 'fixed'::"pricing_mode" NOT NULL,
	"price_per_adult" bigint,
	"price_per_child" bigint,
	"fixed_price" bigint,
	"estimated_cost" bigint,
	"inclusions" text[],
	"exclusions" text[],
	"terms_and_conditions" text,
	"status" "itinerary_status" DEFAULT 'draft'::"itinerary_status" NOT NULL,
	"valid_until" date,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "itinerary_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"itinerary_id" uuid NOT NULL,
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
CREATE TABLE "itinerary_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"itinerary_id" uuid NOT NULL,
	"day_id" uuid,
	"url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"channel" "followup_channel" DEFAULT 'call'::"followup_channel" NOT NULL,
	"note" text,
	"status" "followup_status" DEFAULT 'pending'::"followup_status" NOT NULL,
	"outcome" text,
	"assigned_to" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"destination" text,
	"travel_date" date,
	"duration_days" integer,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"budget" bigint,
	"status" "lead_status" DEFAULT 'new'::"lead_status" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"source" "lead_source" DEFAULT 'walk_in'::"lead_source" NOT NULL,
	"assigned_to" uuid,
	"requirements" text,
	"lost_reason" text,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supplier_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"supplier_id" uuid NOT NULL,
	"title" text NOT NULL,
	"unit" text DEFAULT 'per night' NOT NULL,
	"rate" bigint NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"type" "supplier_type" DEFAULT 'hotel'::"supplier_type" NOT NULL,
	"contact_person" text,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"gstin" text,
	"payment_terms" text,
	"bank_details" text,
	"rating" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"changes" jsonb,
	"summary" text,
	"user_id" uuid,
	"user_name" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_cost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"category" "cost_category" NOT NULL,
	"supplier_id" uuid,
	"vehicle_id" uuid,
	"description" text NOT NULL,
	"service_date" date,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" bigint DEFAULT 0 NOT NULL,
	"cost_amount" bigint DEFAULT 0 NOT NULL,
	"sell_amount" bigint DEFAULT 0 NOT NULL,
	"status" "cost_status" DEFAULT 'planned'::"cost_status" NOT NULL,
	"payment_status" "payable_status" DEFAULT 'unpaid'::"payable_status" NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"confirmation_no" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"license_number" text,
	"license_expiry" date,
	"address" text,
	"daily_allowance" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vehicle_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_odometer" integer,
	"end_odometer" integer,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reg_number" text NOT NULL,
	"type" "vehicle_type" DEFAULT 'suv'::"vehicle_type" NOT NULL,
	"make" text,
	"model" text,
	"seating_capacity" integer DEFAULT 4 NOT NULL,
	"ownership" "ownership" DEFAULT 'owned'::"ownership" NOT NULL,
	"supplier_id" uuid,
	"default_driver_id" uuid,
	"rate_per_km" bigint,
	"rate_per_day" bigint,
	"insurance_expiry" date,
	"fitness_expiry" date,
	"puc_expiry" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_number_key" ON "expenses" ("number");--> statement-breakpoint
CREATE INDEX "expenses_booking_idx" ON "expenses" ("booking_id");--> statement-breakpoint
CREATE INDEX "expenses_vehicle_idx" ON "expenses" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_spent_at_idx" ON "expenses" ("spent_at");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" ("invoice_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" ("number");--> statement-breakpoint
CREATE INDEX "invoices_booking_idx" ON "invoices" ("booking_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" ("status");--> statement-breakpoint
CREATE INDEX "invoices_issue_date_idx" ON "invoices" ("issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_number_key" ON "receipts" ("number");--> statement-breakpoint
CREATE INDEX "receipts_booking_idx" ON "receipts" ("booking_id");--> statement-breakpoint
CREATE INDEX "receipts_invoice_idx" ON "receipts" ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_received_at_idx" ON "receipts" ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_number_key" ON "supplier_payments" ("number");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_booking_idx" ON "supplier_payments" ("booking_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_paid_at_idx" ON "supplier_payments" ("paid_at");--> statement-breakpoint
CREATE INDEX "booking_pax_booking_idx" ON "booking_pax" ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings" ("code");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" ("status");--> statement-breakpoint
CREATE INDEX "bookings_start_date_idx" ON "bookings" ("start_date");--> statement-breakpoint
CREATE INDEX "bookings_assigned_idx" ON "bookings" ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_key" ON "customers" ("phone");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" ("name");--> statement-breakpoint
CREATE INDEX "customers_deleted_at_idx" ON "customers" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_date_key" ON "attendance" ("employee_id","date");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_emp_code_key" ON "employees" ("emp_code");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" ("status");--> statement-breakpoint
CREATE INDEX "employees_user_idx" ON "employees" ("user_id");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_dates_idx" ON "leave_requests" ("from_date","to_date");--> statement-breakpoint
CREATE UNIQUE INDEX "itineraries_code_key" ON "itineraries" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "itineraries_share_token_key" ON "itineraries" ("share_token");--> statement-breakpoint
CREATE INDEX "itineraries_kind_status_idx" ON "itineraries" ("kind","status");--> statement-breakpoint
CREATE INDEX "itineraries_lead_idx" ON "itineraries" ("lead_id");--> statement-breakpoint
CREATE INDEX "itineraries_customer_idx" ON "itineraries" ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_days_unique" ON "itinerary_days" ("itinerary_id","day_number");--> statement-breakpoint
CREATE INDEX "itinerary_days_itinerary_idx" ON "itinerary_days" ("itinerary_id");--> statement-breakpoint
CREATE INDEX "itinerary_images_itinerary_idx" ON "itinerary_images" ("itinerary_id","sort_order");--> statement-breakpoint
CREATE INDEX "itinerary_images_day_idx" ON "itinerary_images" ("day_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_idx" ON "lead_activities" ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_followups_lead_idx" ON "lead_followups" ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_followups_due_idx" ON "lead_followups" ("due_at");--> statement-breakpoint
CREATE INDEX "lead_followups_status_due_idx" ON "lead_followups" ("status","due_at");--> statement-breakpoint
CREATE INDEX "lead_followups_assigned_idx" ON "lead_followups" ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_code_key" ON "leads" ("code");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" ("status");--> statement-breakpoint
CREATE INDEX "leads_assigned_to_idx" ON "leads" ("assigned_to");--> statement-breakpoint
CREATE INDEX "leads_customer_idx" ON "leads" ("customer_id");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" ("created_at");--> statement-breakpoint
CREATE INDEX "supplier_rates_supplier_idx" ON "supplier_rates" ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_rates_supplier_title_key" ON "supplier_rates" ("supplier_id","title");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" ("name");--> statement-breakpoint
CREATE INDEX "suppliers_type_idx" ON "suppliers" ("type");--> statement-breakpoint
CREATE INDEX "suppliers_active_idx" ON "suppliers" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings" ("key");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counters_key_scope_key" ON "counters" ("key","scope");--> statement-breakpoint
CREATE INDEX "trip_cost_items_booking_idx" ON "trip_cost_items" ("booking_id");--> statement-breakpoint
CREATE INDEX "trip_cost_items_category_idx" ON "trip_cost_items" ("category");--> statement-breakpoint
CREATE INDEX "trip_cost_items_supplier_idx" ON "trip_cost_items" ("supplier_id");--> statement-breakpoint
CREATE INDEX "trip_cost_items_vehicle_idx" ON "trip_cost_items" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trip_cost_items_service_date_idx" ON "trip_cost_items" ("service_date");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" ("role");--> statement-breakpoint
CREATE INDEX "drivers_active_idx" ON "drivers" ("is_active");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_vehicle_dates_idx" ON "vehicle_assignments" ("vehicle_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_booking_idx" ON "vehicle_assignments" ("booking_id");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_driver_idx" ON "vehicle_assignments" ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_reg_number_key" ON "vehicles" ("reg_number");--> statement-breakpoint
CREATE INDEX "vehicles_active_idx" ON "vehicles" ("is_active");--> statement-breakpoint
CREATE INDEX "vehicles_ownership_idx" ON "vehicles" ("ownership");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id");--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id");--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_trip_cost_item_id_trip_cost_items_id_fkey" FOREIGN KEY ("trip_cost_item_id") REFERENCES "trip_cost_items"("id");--> statement-breakpoint
ALTER TABLE "booking_pax" ADD CONSTRAINT "booking_pax_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_itinerary_id_itineraries_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_itinerary_id_itineraries_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "itinerary_images" ADD CONSTRAINT "itinerary_images_itinerary_id_itineraries_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "itinerary_images" ADD CONSTRAINT "itinerary_images_day_id_itinerary_days_id_fkey" FOREIGN KEY ("day_id") REFERENCES "itinerary_days"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_followups" ADD CONSTRAINT "lead_followups_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_followups" ADD CONSTRAINT "lead_followups_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "supplier_rates" ADD CONSTRAINT "supplier_rates_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_default_driver_id_drivers_id_fkey" FOREIGN KEY ("default_driver_id") REFERENCES "drivers"("id");