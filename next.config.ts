import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Bookings became Trips and the invoice module became a print button on
      // the trip. Bookmarks and shared links from before the rename still work.
      {
        source: "/admin/bookings",
        destination: "/admin/trips",
        permanent: true,
      },
      {
        source: "/admin/bookings/:id",
        destination: "/admin/trips/:id",
        permanent: true,
      },
      {
        source: "/admin/invoices",
        destination: "/admin/trips",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
