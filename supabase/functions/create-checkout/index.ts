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
    console.log("=== Starting create-checkout function ===");
    
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
    console.log("✅ User authenticated:", user.email);

    // 🧩 Step 2: Parse request body
    const body = await req.json();
    console.log("Request body:", body);
    
    const { orderIds } = body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      console.error("Invalid orderIds in request body:", body);
      throw new Error("Missing or invalid orderIds in request");
    }

    console.log("Processing checkout for", orderIds.length, "orders:", orderIds);

    // 🧩 Step 3: Fetch all orders
    const { data: orders, error: ordersError } = await supabaseClient
      .from("orders")
      .select("*")
      .in("id", orderIds);

    if (ordersError) {
      console.error("Orders lookup failed:", ordersError);
      throw new Error("Orders not found: " + ordersError.message);
    }
    
    if (!orders || orders.length === 0) {
      console.error("No orders data returned for ids:", orderIds);
      throw new Error("Orders not found");
    }

    console.log("✅ Found", orders.length, "orders");

    // 🧩 Step 4: Calculate total and prepare line items
    let totalAmount = 0;
    const lineItems: any[] = [];
    const currency = (orders[0].currency || "EUR").toLowerCase();

    for (const order of orders) {
      // Validate order total
      if (!order.total_price || order.total_price <= 0) {
        console.error("Invalid total_price for order:", order.id, order.total_price);
        throw new Error(`Invalid order total price for order ${order.id}: ${order.total_price}`);
      }

      const orderAmount = Math.round(Number(order.total_price) * 100); // convert to cents
      totalAmount += orderAmount;

      // Fetch design details if design_id exists
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
          console.warn("Failed to fetch design details for order", order.id, e);
        }
      }

      // Build product description
      let description = `Custom ${wristbandType} wristband`;
      if (order.print_type && order.print_type !== "none") {
        description += ` with ${
          order.print_type === "black" ? "black print" : "full color print"
        }`;
      }
      if (order.has_secure_guests) {
        description += " + secure guests option";
      }
      if (order.quantity) {
        description += ` (${order.quantity} pcs)`;
      }

      // Add line item
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `EU Wristbands - ${
              wristbandType.charAt(0).toUpperCase() + wristbandType.slice(1)
            }`,
            description,
          },
          unit_amount: orderAmount,
        },
        quantity: 1,
      });
    }

    console.log("✅ Total amount:", totalAmount, "cents, currency:", currency);
    console.log("✅ Line items prepared:", lineItems.length);

    // 🧩 Step 5: Initialize Stripe
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 🧩 Step 6: Retrieve or create a Stripe customer
    let customerId: string | undefined;
    
    if (user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log("✅ Existing Stripe customer found:", customerId);
        } else {
          console.log("No existing Stripe customer, will create during checkout");
        }
      } catch (e) {
        console.warn("Failed to lookup Stripe customer:", e);
      }
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";
    console.log("Using origin for redirects:", origin);

    // 🧩 Step 7: Create Stripe Checkout Session
    const sessionParams: any = {
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/design-studio?canceled=true`,
      metadata: {
        orderIds: orderIds.join(","),
        userId: user.id,
      },
    };

    // Add customer info
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    console.log("Creating Stripe checkout session with params:", {
      lineItemsCount: lineItems.length,
      mode: sessionParams.mode,
      customerEmail: sessionParams.customer_email,
      customerId: sessionParams.customer,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("✅ Checkout session created:", session.id);
    console.log("✅ Checkout URL:", session.url);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Error in create-checkout:", error);
    console.error("Error stack:", error.stack);
    
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
