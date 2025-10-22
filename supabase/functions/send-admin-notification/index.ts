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

    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        profiles:user_id (email, full_name),
        designs:design_id (design_url, wristband_type, wristband_color, custom_text)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const userEmail = order.profiles?.email || "Unknown";
    const userName = order.profiles?.full_name || "Customer";
    const currencySymbol = order.currency === "USD" ? "$" : order.currency === "EUR" ? "€" : "£";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #FF6B6B; padding-bottom: 10px;">New Order Received! 🚨</h1>
        
        <p><strong>A new order has been placed and requires your attention.</strong></p>
        
        <h2 style="color: #555; margin-top: 30px;">Order Details</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Customer:</strong> ${userName} (${userEmail})</p>
          <p><strong>Quantity:</strong> ${order.quantity} pieces</p>
          <p><strong>Wristband Type:</strong> ${order.designs?.wristband_type || 'N/A'}</p>
          <p><strong>Wristband Color:</strong> ${order.designs?.wristband_color || 'N/A'}</p>
          ${order.designs?.custom_text ? `<p><strong>Custom Text:</strong> ${order.designs.custom_text}</p>` : ''}
          ${order.print_type && order.print_type !== 'none' ? `<p><strong>Print Type:</strong> ${order.print_type === 'black' ? 'Black Print' : 'Full Color Print'}</p>` : ''}
          ${order.has_secure_guests ? '<p><strong>Secure Guests:</strong> Yes</p>' : ''}
          <p><strong>Total Amount:</strong> ${currencySymbol}${order.total_price.toFixed(2)}</p>
          <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        </div>
        
        ${order.shipping_address ? `
        <h2 style="color: #555; margin-top: 30px;">Shipping Address</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p>${order.shipping_address.name || userName}</p>
          <p>${order.shipping_address.address}</p>
          <p>${order.shipping_address.city}, ${order.shipping_address.state || ''} ${order.shipping_address.zipCode}</p>
          <p>${order.shipping_address.country}</p>
          ${order.shipping_address.phone ? `<p><strong>Phone:</strong> ${order.shipping_address.phone}</p>` : ''}
        </div>
        ` : ''}
        
        ${order.designs?.design_url ? `
        <h2 style="color: #555; margin-top: 30px;">Design Preview</h2>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${order.designs.design_url}" alt="Wristband Design" style="max-width: 100%; border-radius: 8px; border: 1px solid #ddd;" />
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://mzhdqijjmdfiemeuworf.supabase.co/dashboard" 
             style="background: #4CAF50; 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    display: inline-block;
                    font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>
        
        <p style="margin-top: 30px;">Please review and approve/decline this order in the admin dashboard.</p>
        
        <p style="margin-top: 20px;">Best regards,<br><strong>EU Wristbands System</strong></p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
          <p>This is an automated notification from your EU Wristbands system.</p>
        </div>
      </div>
    `;

    // Send email to admin
    const { error: emailError } = await resend.emails.send({
      from: "EU Wristbands <onboarding@resend.dev>",
      to: ["aqeelg136@gmail.com"], // Admin email
      subject: `New Order #${order.id.slice(0, 8)} - ${order.quantity} Wristbands`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email sending error:", emailError);
      throw emailError;
    }

    console.log(`Admin notification sent for order ${orderId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Admin notification sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending admin notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
