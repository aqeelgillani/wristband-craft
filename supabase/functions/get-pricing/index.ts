import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const { wristbandType, quantity, currency, printType, hasSecureGuests } = await req.json();

    // Fetch pricing configuration from database
    const { data: pricingConfig, error } = await supabaseClient
      .from("pricing_config")
      .select("*")
      .eq("wristband_type", wristbandType)
      .single();

    if (error || !pricingConfig) {
      return new Response(
        JSON.stringify({ error: "Pricing configuration not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const currencyLower = currency.toLowerCase();
    const minQuantity = pricingConfig.min_quantity;

    if (quantity < minQuantity) {
      return new Response(
        JSON.stringify({ 
          error: `Minimum quantity is ${minQuantity} pieces`,
          minQuantity 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Calculate base price
    const basePriceKey = `base_price_${currencyLower}`;
    const basePrice = pricingConfig[basePriceKey];

    // Calculate extra charges
    let extraCharges: Record<string, number> = {};
    let totalExtras = 0;

    if (printType === "black") {
      const blackPrintKey = `black_print_extra_${currencyLower}`;
      extraCharges.blackPrint = pricingConfig[blackPrintKey];
      totalExtras += extraCharges.blackPrint;
    } else if (printType === "full_color") {
      const fullColorKey = `full_color_print_extra_${currencyLower}`;
      extraCharges.fullColorPrint = pricingConfig[fullColorKey];
      totalExtras += extraCharges.fullColorPrint;
    }

    if (hasSecureGuests) {
      const secureGuestsKey = `secure_guests_extra_${currencyLower}`;
      extraCharges.secureGuests = pricingConfig[secureGuestsKey];
      totalExtras += extraCharges.secureGuests;
    }

    const unitPrice = basePrice + totalExtras;
    const totalPrice = unitPrice * quantity;

    return new Response(
      JSON.stringify({
        basePrice,
        extraCharges,
        unitPrice,
        totalPrice,
        quantity,
        currency: currency.toUpperCase(),
        minQuantity,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error calculating pricing:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
