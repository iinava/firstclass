ALTER TYPE "attendance_status" ADD VALUE 'leave_unpaid';--> statement-breakpoint
DROP INDEX "customers_phone_key";--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_key" ON "customers" ("phone") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id");--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_source_package_id_itineraries_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "itineraries"("id");--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_parent_itinerary_id_itineraries_id_fkey" FOREIGN KEY ("parent_itinerary_id") REFERENCES "itineraries"("id");--> statement-breakpoint
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id");