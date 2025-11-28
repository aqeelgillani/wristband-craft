// File: supabase/functions/create-checkout/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    if (!authHeader) {
      console.error("Missing Authorization header");
      throw new Error("Missing Authorization header");
    }

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
    
    if (userError) {
      console.error("Auth error:", userError);
      throw new Error("User not authenticated: " + userError.message);
    }
    
    if (!userData?.user) {
      console.error("No user data returned");
      throw new Error("User not authenticated");
    }

    const user = userData.user;
    console.log("User authenticated:", user.email);

    // 🧩 Step 2: Parse request body
    const body = await req.json();
    const { orderId } = body;
    
    if (!orderId) {
      console.error("Missing orderId in request body:", body);
      throw new Error("Missing orderId in request");
    }

    console.log("Processing checkout for orderId:", orderId);

    // 🧩 Step 3: Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error("Order lookup failed:", orderError);
      throw new Error("Order not found: " + orderError.message);
    }
    
    if (!order) {
      console.error("No order data returned for id:", orderId);
      throw new Error("Order not found");
    }

    console.log("Order found:", order.id, "Total:", order.total_price);

    // Optionally fetch design details if design_id exists
    let wristbandType = "silicone";
    if (order.design_id) {
      try {
        const { data: design } = await supabaseClient
          .from("designs")
          .select("wristband_type")
          .eq("id", order.design_id)
          .single();
        if (design?.wristband_type) {
          wristbandType = design.wristband_type;
        }
      } catch (e) {
        console.warn("Failed to fetch design details, using default:", e);
      }
    }

    // Validate total_price
    if (!order.total_price || order.total_price <= 0) {
      throw new Error("Invalid order total price: " + order.total_price);
    }

    const totalAmount = Math.round(Number(order.total_price) * 100); // convert to cents
    const currency = (order.currency || "USD").toLowerCase();

    console.log("Stripe amount:", totalAmount, "cents, currency:", currency);

    // 🧩 Step 4: Initialize Stripe
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 🧩 Step 5: Retrieve or create a Stripe customer
    let customerId: string | undefined;
    
    if (user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log("Existing Stripe customer found:", customerId);
        } else {
          console.log("No existing Stripe customer, will create during checkout");
        }
      } catch (e) {
        console.warn("Failed to lookup Stripe customer:", e);
      }
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

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";
    console.log("Using origin for redirects:", origin);

    // 🧩 Step 7: Create Stripe Checkout Session
    const sessionParams: any = {
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
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/design-studio?canceled=true`,
      metadata: {
        orderId,
        userId: user.id,
      },
    };

    // Add customer info
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    console.log("Creating Stripe checkout session...");
    const session = await stripe.checkout.sessions.create(sessionParams);

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
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
