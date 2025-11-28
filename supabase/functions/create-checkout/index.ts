// File: supabase/functions/create-checkout/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Basic CORS setup for Supabase Functions
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🧩 Step 1: Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Create Supabase client with auth token for RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("User not authenticated");

    const user = userData.user;
    console.log("User authenticated:", user.email);

    // 🧩 Step 2: Parse request body
    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId in request");

    // 🧩 Step 3: Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order lookup failed:", orderError);
      throw new Error("Order not found");
    }

    // Optionally fetch design details if design_id exists
    let wristbandType = "silicone";
    if (order.design_id) {
      try {
        const { data: design } = await supabaseClient
          .from("designs")
          .select("wristband_type")
          .eq("id", order.design_id)
          .single();
        if (design) {
          wristbandType = design.wristband_type;
        }
      } catch (e) {
        console.warn("Failed to fetch design details, using default");
      }
    }

    const totalAmount = Math.round(order.total_price * 100); // convert to cents
    const currency = (order.currency || "USD").toLowerCase();

    // 🧩 Step 4: Initialize Stripe
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) throw new Error("Stripe secret key not configured");

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-09-30", // Use a stable API version
    });

    // 🧩 Step 5: Retrieve or create a Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // 🧩 Step 6: Build product description
    let description = `Custom ${wristbandType} wristband`;
    if (order.print_type && order.print_type !== "none") {
      description += ` with ${
        order.print_type === "black" ? "black print" : "full color print"
      }`;
    }
    if (order.has_secure_guests) {
      description += " + secure guests option";
    }

    // 🧩 Step 7: Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `EU Wristbands - ${
                wristbandType.charAt(0).toUpperCase() + wristbandType.slice(1)
              }`,
              description,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/design-studio?canceled=true`,
      metadata: {
        orderId,
        userId: user.id,
      },
    });

    console.log("✅ Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Error in create-checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
