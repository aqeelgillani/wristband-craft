import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user) throw new Error("User not authenticated");

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    const { orderId, status, adminNotes } = await req.json();

    const validStatuses = ["pending", "approved", "declined", "processing", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const updateData: any = { status };
    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { data: order, error: updateError } = await supabaseClient
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // --- Send Status Update Email to User ---
    try {
      // Re-initialize client with service role key to fetch user email (RLS bypass)
      const serviceRoleClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: orderDetails, error: fetchError } = await serviceRoleClient
        .from("orders")
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .eq("id", orderId)
        .single();

      if (fetchError || !orderDetails || !orderDetails.profiles?.email) {
        console.error("Failed to fetch order details for status email:", fetchError);
      } else {
        const userEmail = orderDetails.profiles.email;
        const userName = orderDetails.profiles.full_name || "Customer";
        const currencySymbol = orderDetails.currency === "USD" ? "$" : orderDetails.currency === "EUR" ? "€" : "£";
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">Order Status Update!</h1>
            
            <p>Dear ${userName},</p>
            
            <p>The status of your order <strong>#${orderId.substring(0, 8)}</strong> has been updated to: <strong>${status.toUpperCase()}</strong>.</p>
            
            <h2 style="color: #555; margin-top: 30px;">Order Details</h2>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>New Status:</strong> <span style="color: #4CAF50; font-weight: bold;">${status.toUpperCase()}</span></p>
              <p><strong>Total Amount:</strong> ${currencySymbol}${orderDetails.total_price.toFixed(2)}</p>
              ${adminNotes ? `<p><strong>Supplier Note:</strong> ${adminNotes}</p>` : ''}
            </div>
            
            <p style="margin-top: 30px;">You can view the full details of your order in your dashboard.</p>
            
            <p style="margin-top: 20px;">Best regards,<br><strong>EU Wristbands Team</strong></p>
          </div>
        `;

        const { error: emailError } = await resend.emails.send({
          from: "EU Wristbands <onboarding@resend.dev>",
          to: [userEmail],
          subject: `Update: Your Order #${orderId.substring(0, 8)} is now ${status.toUpperCase()}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error("Error sending status update email:", emailError);
        } else {
          console.log(`Status update email sent successfully to ${userEmail}`);
        }
      }
    } catch (e) {
      console.error("General error in status update email logic:", e);
    }
    // --- End Send Status Update Email to User ---

    if (updateError) {
      throw updateError;
    }

    console.log(`Order ${orderId} status updated to ${status} by admin ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, order }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
