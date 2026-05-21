// lib/pricing.ts

export interface PricingDetails {
  totalPrice: number;
  monthlyPrice: number;
  monthlyOngoing: number;
}

export function calculatePrice(userInput: any): PricingDetails {
  const features: string[] = Array.isArray(userInput?.features) ? userInput.features : [];
  const pageCount = Array.isArray(userInput?.pages) ? userInput.pages.length : 1;
  const hasEcommerce = features.includes("Payments / Shop");
  const hasBooking = features.includes("Booking System");
  const isMultiPage = userInput?.siteType === "multi";

  let totalPrice = 1500;
  if (pageCount >= 7 || (isMultiPage && pageCount >= 5)) {
    totalPrice = 3800;
  } else if (pageCount >= 4 || isMultiPage) {
    totalPrice = 2400;
  }

  if (hasBooking) totalPrice += 400;
  if (hasEcommerce) totalPrice += 600;

  features.forEach(f => {
    if (f === "Blog") totalPrice += 200;
    if (f === "Photo Gallery") totalPrice += 150;
    if (f === "Reviews & Testimonials") totalPrice += 100;
    if (f === "Live Chat") totalPrice += 150;
    if (f === "Newsletter Signup") totalPrice += 100;
    if (f === "Video Background") totalPrice += 200;
  });

  return {
    totalPrice,
    monthlyPrice: 109,
    monthlyOngoing: 119
  };
}
