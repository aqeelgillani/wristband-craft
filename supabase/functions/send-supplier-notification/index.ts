import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    console.log("Fetching order details for:", orderId);

    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        profiles:user_id (email, full_name),
        designs:design_id (design_url, wristband_type, wristband_color, custom_text),
        suppliers:supplier_id (company_name, contact_email)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      throw new Error("Order not found");
    }

    const supplierEmail = order.suppliers?.contact_email;
    if (!supplierEmail) {
      console.error("Supplier email not found");
      throw new Error("Supplier email not found");
    }

    const userName = order.profiles?.full_name || "Customer";
    const userEmail = order.profiles?.email || "N/A";
    const supplierName = order.suppliers?.company_name || "Supplier";

    console.log("Sending notification to supplier:", supplierEmail);

    const currencySymbol = order.currency === "USD" ? "$" : order.currency === "EUR" ? "€" : "£";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">New Order Received! 🎉</h1>
        
        <p>Dear ${supplierName},</p>
        
        <p>A new custom wristband order has been placed and assigned to you. Please review the production details below.</p>
        
        <h2 style="color: #555; margin-top: 30px;">Order Details</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}</p>
          <p><strong>Customer:</strong> ${userName} (${userEmail})</p>
          <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>Payment Status:</strong> ${order.payment_status}</p>
          <p><strong>Order Status:</strong> ${order.status}</p>
        </div>
        
        <h2 style="color: #555; margin-top: 30px;">Production Specifications</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>Quantity:</strong> ${order.quantity} pieces</p>
          <p><strong>Wristband Type:</strong> ${order.designs?.wristband_type || 'N/A'}</p>
          <p><strong>Wristband Color:</strong> ${order.designs?.wristband_color || 'N/A'}</p>
          ${order.print_type && order.print_type !== 'none' ? `<p><strong>Print Type:</strong> ${order.print_type === 'black' ? 'Black Print' : 'Full Color Print'}</p>` : ''}
          ${order.designs?.custom_text ? `<p><strong>Custom Text:</strong> ${order.designs.custom_text}</p>` : ''}
          ${order.has_secure_guests ? '<p><strong>Security Features:</strong> QR Code / Secure Guests Enabled</p>' : ''}
          <p><strong>Total Amount:</strong> ${currencySymbol}${order.total_price.toFixed(2)}</p>
        </div>
        
        ${order.designs?.design_url ? `
        <h2 style="color: #555; margin-top: 30px;">Design Preview</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center;">
          <img src="${order.designs.design_url}" alt="Wristband Design" style="max-width: 100%; height: auto; border-radius: 8px;" />
        </div>
        ` : ''}
        
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
        
        <p style="margin-top: 30px;">Please log in to your supplier dashboard to manage this order and update its production status.</p>
        
        <p style="margin-top: 20px;">If you have any questions, please contact support.</p>
        
        <p style="margin-top: 30px;">Best regards,<br><strong>EU Wristbands Team</strong></p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "EU Wristbands <onboarding@resend.dev>",
      to: [supplierEmail],
      subject: `New Order #${order.id.substring(0, 8)} - ${order.quantity} Wristbands`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email sending error:", emailError);
      throw emailError;
    }

    console.log("Supplier notification email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending supplier notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
