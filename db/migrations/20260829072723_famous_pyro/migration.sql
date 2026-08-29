ALTER TABLE "employees" RENAME COLUMN "monthly_salary" TO "day_rate";--> statement-breakpoint
-- The renamed column still holds the old monthly figure; convert it to a
-- per-day figure so existing employees aren't suddenly paid 30x their salary.
UPDATE "employees" SET "day_rate" = ROUND("day_rate" / 30.0) WHERE "day_rate" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "paid_leaves_per_month" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD COLUMN "paid_leave_allowance" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" DROP COLUMN "paid_leave_allowance";