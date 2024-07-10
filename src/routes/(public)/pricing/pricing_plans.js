export const default_plan_id = "free";

export const pricing_plans = [
  {
    id: "free",
    name: "Free",
    description: "A free plan to get you started!",
    price: "$0",
    price_interval_name: "per month",
    stripe_price_id: null,
    stripe_product_id: null,
    features: ["Fast performance", "Stripe integration", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "A plan to test the purchase experience. Try buying this with the test Visa credit card 4242424242424242.",
    price: "$5",
    price_interval_name: "per month",
    stripe_price_id: "price_1PGuCEJtb0cu2GQlP8JjnwKd", // this is the price ID from Stripe
    stripe_product_id: "prod_Q78TtLk34bY2Zo", // this is the product ID from Stripe
    features: [
      "Everything in Free",
      "Try to purchase with fake money",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "A plan to test the upgrade expereince. Try buying this with the test Visa credit card 4242424242424242.",
    price: "$15",
    price_interval_name: "per month",
    stripe_price_id: "price_1PGuRlJtb0cu2GQl0xzlG98q",
    stripe_product_id: "prod_Q78jWCxLED8Phf",
    features: [
      "Everything in Pro",
      "Try to upgrade with fake money",
      "Enterprise support",
    ],
  },
];
