ALTER TABLE "booking_days" ADD COLUMN "hotel_supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD COLUMN "hotel_supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_days" ADD CONSTRAINT "booking_days_hotel_supplier_id_suppliers_id_fkey" FOREIGN KEY ("hotel_supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_hotel_supplier_id_suppliers_id_fkey" FOREIGN KEY ("hotel_supplier_id") REFERENCES "suppliers"("id");