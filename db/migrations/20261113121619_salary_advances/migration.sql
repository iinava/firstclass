CREATE TABLE "salary_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount" bigint NOT NULL,
	"given_on" date NOT NULL,
	"mode" "payment_mode" DEFAULT 'cash'::"payment_mode" NOT NULL,
	"notes" text,
	"expense_id" uuid,
	"payroll_line_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD COLUMN "advance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "advance_total" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "salary_advances_month_idx" ON "salary_advances" ("month");--> statement-breakpoint
CREATE INDEX "salary_advances_employee_idx" ON "salary_advances" ("employee_id");--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id");--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_payroll_line_id_payroll_lines_id_fkey" FOREIGN KEY ("payroll_line_id") REFERENCES "payroll_lines"("id") ON DELETE SET NULL;