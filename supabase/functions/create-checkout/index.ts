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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Starting create-checkout function ===");

  try {
    // 🧩 Step 1: Authenticate user
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("❌ Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    console.log("Environment check:", {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      stripeSecret: !!stripeSecret,
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Supabase environment variables missing");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!stripeSecret) {
      console.error("❌ STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error("❌ Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Authentication failed: " + userError.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }
    
    if (!userData?.user) {
      console.error("❌ No user data returned");
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const user = userData.user;
    console.log("✅ User authenticated:", user.email);

    // 🧩 Step 2: Parse request body
    let body;
    try {
      body = await req.json();
      console.log("✅ Request body parsed:", body);
    } catch (e) {
      console.error("❌ Failed to parse request body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    const { orderIds } = body;
    
    if (!orderIds) {
      console.error("❌ Missing orderIds in request body:", body);
      return new Response(
        JSON.stringify({ error: "Missing orderIds in request" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      console.error("❌ Invalid orderIds format:", orderIds);
      return new Response(
        JSON.stringify({ error: "orderIds must be a non-empty array" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("✅ Processing checkout for", orderIds.length, "orders:", orderIds);

    // 🧩 Step 3: Fetch all orders
    const { data: orders, error: ordersError } = await supabaseClient
      .from("orders")
      .select("*")
      .in("id", orderIds);

    if (ordersError) {
      console.error("❌ Orders lookup failed:", ordersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch orders: " + ordersError.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }
    
    if (!orders || orders.length === 0) {
      console.error("❌ No orders found for ids:", orderIds);
      return new Response(
        JSON.stringify({ error: "No orders found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    console.log("✅ Found", orders.length, "orders");

    // 🧩 Step 4: Validate and prepare line items
    const lineItems: any[] = [];
    const currency = (orders[0].currency || "EUR").toLowerCase();
    let totalAmount = 0;

    console.log("Currency:", currency);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`Processing order ${i + 1}/${orders.length}:`, {
        id: order.id,
        total_price: order.total_price,
        currency: order.currency,
        design_id: order.design_id,
      });

      // Validate order total
      if (!order.total_price || order.total_price <= 0) {
        console.error("❌ Invalid total_price for order:", order.id, order.total_price);
        return new Response(
          JSON.stringify({ 
            error: `Invalid order total price for order ${order.id}: ${order.total_price}` 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      const orderAmount = Math.round(Number(order.total_price) * 100);
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
          console.warn("⚠️ Failed to fetch design for order", order.id, "using default");
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
        description += " + secure guests";
      }
      if (order.quantity) {
        description += ` (${order.quantity} pcs)`;
      }

      // Add line item
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `EU Wristbands - ${wristbandType.charAt(0).toUpperCase() + wristbandType.slice(1)}`,
            description,
          },
          unit_amount: orderAmount,
        },
        quantity: 1,
      });

      console.log(`✅ Line item ${i + 1} created:`, {
        name: lineItems[i].price_data.product_data.name,
        amount: orderAmount,
      });
    }

    console.log("✅ Total amount:", totalAmount, "cents");
    console.log("✅ Total line items:", lineItems.length);

    // 🧩 Step 5: Initialize Stripe
    console.log("Initializing Stripe...");
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
    console.log("✅ Stripe initialized");

    // 🧩 Step 6: Retrieve or create Stripe customer
    let customerId: string | undefined;
    
    if (user.email) {
      try {
        console.log("Looking up Stripe customer for:", user.email);
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          console.log("✅ Found existing Stripe customer:", customerId);
        } else {
          console.log("No existing customer, will create during checkout");
        }
      } catch (e) {
        console.warn("⚠️ Failed to lookup Stripe customer:", e);
      }
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";
    console.log("Using origin:", origin);

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

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    console.log("Creating Stripe session with:", {
      lineItems: lineItems.length,
      mode: sessionParams.mode,
      customer: sessionParams.customer,
      customer_email: sessionParams.customer_email,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("✅ Checkout session created:", session.id);
    console.log("✅ Session URL:", session.url);

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        sessionId: session.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("❌❌❌ FATAL ERROR in create-checkout ❌❌❌");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
