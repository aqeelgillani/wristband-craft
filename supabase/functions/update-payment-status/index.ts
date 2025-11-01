import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get order by stripe session id
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Update payment status based on Stripe session status
    const paymentStatus = session.payment_status === "paid" ? "paid" : "pending";
    const orderStatus = paymentStatus === "paid" ? "approved" : order.status;

    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        payment_status: paymentStatus,
        status: orderStatus,
        stripe_payment_intent_id: session.payment_intent,
      })
      .eq("id", order.id);

    if (updateError) {
      throw updateError;
    }

    // If paid, automatically send confirmation email and admin notification
    if (paymentStatus === "paid") {
      // Send order confirmation to customer
      await supabaseClient.functions.invoke("send-order-confirmation", {
        body: { orderId: order.id },
      });

      // Send admin notification
      await supabaseClient.functions.invoke("send-admin-notification", {
        body: { orderId: order.id },
      });
    }

    console.log(`Order ${order.id} payment status updated to ${paymentStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        paymentStatus,
        orderStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});