CREATE TABLE "payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"monthly_salary" bigint NOT NULL,
	"day_rate" bigint NOT NULL,
	"days_in_month" integer NOT NULL,
	"days_present" integer DEFAULT 0 NOT NULL,
	"days_half" integer DEFAULT 0 NOT NULL,
	"days_absent" integer DEFAULT 0 NOT NULL,
	"days_paid_leave" integer DEFAULT 0 NOT NULL,
	"days_unpaid_leave" integer DEFAULT 0 NOT NULL,
	"days_holiday" integer DEFAULT 0 NOT NULL,
	"days_week_off" integer DEFAULT 0 NOT NULL,
	"days_unmarked" integer DEFAULT 0 NOT NULL,
	"deduction" bigint DEFAULT 0 NOT NULL,
	"net_pay" bigint NOT NULL,
	"expense_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"month" date NOT NULL,
	"paid_leave_allowance" integer DEFAULT 2 NOT NULL,
	"employee_count" integer NOT NULL,
	"gross_total" bigint DEFAULT 0 NOT NULL,
	"deduction_total" bigint DEFAULT 0 NOT NULL,
	"net_total" bigint DEFAULT 0 NOT NULL,
	"posted_by" uuid,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_lines_run_employee_key" ON "payroll_lines" ("run_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_lines_employee_idx" ON "payroll_lines" ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_month_key" ON "payroll_runs" ("month");--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_run_id_payroll_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL;