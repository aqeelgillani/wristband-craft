import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { fetch } from "https://esm.sh/node-fetch@3.3.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to generate PDF
const generateSupplierPDF = (order, shippingAddress) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Production Order Details", 10, 10);
  
  doc.setFontSize(12);
  let y = 20;
  
  const addText = (label, value) => {
    doc.text(`${label}: ${value}`, 10, y);
    y += 7;
  };

  addText("Order ID", order.id.substring(0, 8));
  addText("Customer Name", order.profiles?.full_name || "N/A");
  addText("Customer Email", order.profiles?.email || "N/A");
  addText("Quantity", `${order.quantity} pcs`);
  addText("Wristband Type", order.designs?.wristband_type || 'N/A');
  addText("Wristband Color", order.designs?.wristband_color || 'N/A');
  addText("Print Type", order.print_type === 'black' ? 'Black Print' : order.print_type === 'full_color' ? 'Full Color Print' : 'None');
  if (order.designs?.custom_text) {
    addText("Custom Text", order.designs.custom_text);
  }
  if (order.has_secure_guests) {
    addText("Security Feature", "QR Code / Secure Guests Enabled");
  }
  
  y += 5;
  doc.setFontSize(14);
  doc.text("Shipping Address", 10, y);
  y += 5;
  doc.setFontSize(12);
  addText("Name", shippingAddress.name);
  addText("Street", shippingAddress.address);
  addText("City", shippingAddress.city);
  addText("Zip/Postal Code", shippingAddress.zipCode);
  addText("Country", shippingAddress.country);
  addText("Phone", shippingAddress.phone);

  // NOTE: Image embedding in jspdf in Deno is complex. 
  // For now, I will add a placeholder text and a link to the design image.
  y += 5;
  doc.setFontSize(14);
  doc.text("Design Details (See attached image and link)", 10, y);
  y += 5;
  addText("Design URL", order.designs?.design_url || "N/A");
  
  // Return the PDF as a base64 encoded string
  return doc.output('datauristring').split(',')[1];
};

// Initialize Supabase client with service role key
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // must be service role key
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, testMode } = await req.json();
    console.log("Fetching order details for:", orderId);

    // Fetch order with related profiles, designs, suppliers
   const { data: fetchedOrder, error: orderError } = await supabaseClient
  .from("orders")
  .select(`
    *,
    shipping_address,
    profiles:user_id (email, full_name),
    designs:design_id (design_url, wristband_type, wristband_color, custom_text),
    suppliers:supplier_id (company_name, contact_email)
  `)
  .eq("id", orderId)
  .single();

let order;

if (!fetchedOrder || orderError || testMode) {
  // Check if shipping_address is present in fetchedOrder
  const shippingAddress = fetchedOrder?.shipping_address || {
    name: "Test Name",
    address: "123 Test St",
    city: "Test City",
    state: "Test State",
    zipCode: "12345",
    country: "Test Country",
    phone: "1234567890",
  };
  console.warn("Order not found or test mode enabled, using dummy order");

  order = {
    id: orderId || "TEST1234",
    quantity: 50,
    total_price: 123.45,
    currency: "USD",
    payment_status: "Pending",
    status: "New",
    has_secure_guests: false,
    print_type: "black",
    shipping_address: shippingAddress,
    designs: {
      wristband_type: "Silicone",
      wristband_color: "Red",
      custom_text: "Test Text",
      design_url: "https://via.placeholder.com/150"
    },
    profiles: {
      full_name: "Test Customer",
      email: "testcustomer@example.com"
    },
    suppliers: {
      company_name: "Test Supplier",
      contact_email: "aqeelg136@gmail.com"
    },
    created_at: new Date().toISOString(),
  };
} else {
  order = fetchedOrder;
}

const shippingAddress = order.shipping_address;

    const supplierEmail = order.suppliers?.contact_email || "aqeelg136@gmail.com";
    const userName = order.profiles?.full_name || "Customer";
    const supplierName = order.suppliers?.company_name || "Supplier";
    const currencySymbol = order.currency === "USD" ? "$" : order.currency === "EUR" ? "€" : "£";

    // Build the email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">New Order Received! 🎉</h1>
        <p>Dear ${supplierName},</p>
        <p>A new custom wristband order has been assigned to you. Please review the details below and the attached production PDF and design image.</p>
        <h2 style="color: #555; margin-top: 20px;">Order Details</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}</p>
          <p><strong>Customer:</strong> ${userName} (${order.profiles?.email || "N/A"})</p>
          <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>Payment Status:</strong> ${order.payment_status}</p>
          <p><strong>Order Status:</strong> ${order.status}</p>
          <p><strong>Quantity:</strong> ${order.quantity} pieces</p>
          <p><strong>Wristband Type:</strong> ${order.designs?.wristband_type || 'N/A'}</p>
          <p><strong>Wristband Color:</strong> ${order.designs?.wristband_color || 'N/A'}</p>
          ${order.print_type && order.print_type !== 'none' ? `<p><strong>Print Type:</strong> ${order.print_type === 'black' ? 'Black Print' : 'Full Color Print'}</p>` : ''}
          ${order.designs?.custom_text ? `<p><strong>Custom Text:</strong> ${order.designs.custom_text}</p>` : ''}
          ${order.has_secure_guests ? '<p><strong>Security Features:</strong> QR Code / Secure Guests Enabled</p>' : ''}
          <p><strong>Total Amount:</strong> ${currencySymbol}${order.total_price.toFixed(2)}</p>
        </div>
        ${order.designs?.design_url ? `
        <h2 style="color: #555; margin-top: 20px;">Design Preview</h2>
        <p>The design image is attached to this email.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center;">
          <img src="${order.designs.design_url}" alt="Wristband Design" style="max-width: 100%; height: auto; border-radius: 8px;" />
        </div>` : ''}
        <p style="margin-top: 20px;">Please log in to your supplier dashboard to manage this order.</p>
        <p style="margin-top: 20px;">Best regards,<br><strong>EU Wristbands Team</strong></p>
        <div style="margin-top: 30px; font-size: 12px; color: #888;">This is an automated email. Do not reply directly.</div>
      </div>
    `;

    const pdfBase64 = generateSupplierPDF(order, shippingAddress);
    const recipient = testMode ? ["aqeelg136@gmail.com"] : [supplierEmail];

    // --- Attachment Logic ---
    const attachments = [];
    
    // 1. Attach Production PDF
    attachments.push({
      filename: `Production_Order_${order.id.substring(0, 8)}.pdf`,
      content: pdfBase64,
    });

    // 2. Attach Design Image
    if (order.designs?.design_url) {
      try {
        const response = await fetch(order.designs.design_url);
        const imageBlob = await response.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        
        attachments.push({
          filename: `design-preview-${order.id.substring(0, 8)}.png`,
          content: Buffer.from(imageBuffer).toString("base64"),
        });
        console.log("✅ Design image attached successfully.");
      } catch (e) {
        console.error("❌ Failed to fetch or attach design image:", e);
      }
    }
    // --- End Attachment Logic ---

    console.log(`Sending ${testMode ? "test" : "real"} email to:`, recipient);

    const { error: emailError } = await resend.emails.send({
      from: "EU Wristbands <onboarding@resend.dev>",
      to: recipient,
      subject: `${testMode ? "🧪 TEST: " : ""}New Order #${order.id.substring(0, 8)} - ${order.quantity} Wristbands`,
      attachments: attachments,
      html: testMode
        ? `<p style="color:#888;">This is a TEST email. Actual supplier: ${supplierEmail}</p>${emailHtml}`
        : emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw emailError;
    }

    console.log("Supplier notification email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error sending supplier notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
