ALTER TABLE "supplier_payments" ADD COLUMN "void_reason" text;--> statement-breakpoint
CREATE INDEX "supplier_payments_cost_item_idx" ON "supplier_payments" ("trip_cost_item_id");