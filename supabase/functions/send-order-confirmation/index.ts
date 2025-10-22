import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { orderId } = await req.json();

    // Get order details with user email
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        profiles:user_id (email, full_name),
        designs:design_id (design_url, wristband_type, wristband_color)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const userEmail = order.profiles?.email;
    const userName = order.profiles?.full_name || "Customer";
    
    if (!userEmail) {
      throw new Error("User email not found");
    }

    const currencySymbol = order.currency === "USD" ? "$" : order.currency === "EUR" ? "€" : "£";
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 14); // 2 weeks delivery

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Order Confirmed! 🎉</h1>
        
        <p>Dear ${userName},</p>
        
        <p>Great news! Your custom wristband order has been approved and is now being processed.</p>
        
        <h2 style="color: #555; margin-top: 30px;">Order Summary</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Quantity:</strong> ${order.quantity} pieces</p>
          <p><strong>Wristband Type:</strong> ${order.designs?.wristband_type || 'N/A'}</p>
          ${order.print_type && order.print_type !== 'none' ? `<p><strong>Print Type:</strong> ${order.print_type === 'black' ? 'Black Print' : 'Full Color Print'}</p>` : ''}
          ${order.has_secure_guests ? '<p><strong>Secure Guests:</strong> Yes</p>' : ''}
          <p><strong>Total Amount:</strong> ${currencySymbol}${order.total_price.toFixed(2)}</p>
        </div>
        
        ${order.shipping_address ? `
        <h2 style="color: #555; margin-top: 30px;">Delivery Address</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p>${order.shipping_address.name || userName}</p>
          <p>${order.shipping_address.address}</p>
          <p>${order.shipping_address.city}, ${order.shipping_address.state || ''} ${order.shipping_address.zipCode}</p>
          <p>${order.shipping_address.country}</p>
          ${order.shipping_address.phone ? `<p><strong>Phone:</strong> ${order.shipping_address.phone}</p>` : ''}
        </div>
        ` : ''}
        
        <h2 style="color: #555; margin-top: 30px;">Estimated Delivery</h2>
        <p style="font-size: 18px; color: #4CAF50; font-weight: bold;">
          ${estimatedDelivery.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        
        <p style="margin-top: 30px;">We're working hard to get your custom wristbands to you as quickly as possible!</p>
        
        <p style="margin-top: 20px;">If you have any questions, please don't hesitate to contact us.</p>
        
        <p style="margin-top: 30px;">Best regards,<br><strong>EU Wristbands Team</strong></p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "EU Wristbands <onboarding@resend.dev>",
      to: [userEmail],
      subject: `Order Confirmed - ${order.quantity} Custom Wristbands`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email sending error:", emailError);
      throw emailError;
    }

    console.log(`Order confirmation email sent to ${userEmail} for order ${orderId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending order confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
