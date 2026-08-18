/**
 * Letterhead details for printed documents. Kept as one constant rather than a
 * settings table — it changes once a year at most, and a form to edit it is a
 * screen nobody opens.
 */
export const COMPANY = {
  name: "First Class Travels",
  address: "MG Road, Kochi, Kerala 682016",
  phone: "9876543210",
  email: "hello@firstclasstravels.in",
  gstin: "",
} as const
