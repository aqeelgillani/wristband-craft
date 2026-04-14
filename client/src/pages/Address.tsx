import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShoppingCart, Check } from "lucide-react";

interface LocationState {
  designs: any[];
  expressDelivery?: boolean;
}

interface Supplier {
  id: string;
  company_name: string;
}

const Address = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, company_name")
      .order("company_name");
    
    if (!error && data) {
      setSuppliers(data);
      if (data.length > 0) {
        setSelectedSupplierId(data[0].id);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!shippingAddress.name || !shippingAddress.address || !shippingAddress.city || !shippingAddress.zipCode || !shippingAddress.country) {
      toast.error("Please fill all required address fields");
      return;
    }

    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (!state.designs || state.designs.length === 0) {
      toast.error("No designs to checkout");
      return;
    }

    setLoading(true);
    
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to continue");
        navigate("/auth");
        setLoading(false);
        return;
      }

      console.log("Processing checkout for", state.designs.length, "designs");

      // Collect all order IDs (create orders if needed)
      const orderIds: string[] = [];
      
      for (const d of state.designs) {
        let orderId = d.orderId || d.order_id || null;
        
        // If no orderId exists, create order in database now
        if (!orderId) {
          console.log("Creating new order for design");
          
          try {
            let designId = d.design_id || null;
            let designUrl = d.designUrl;
            
            // Create design record if needed
            if (!designId) {
              const { data: designData, error: designError } = await supabase
                .from("designs")
                .insert({
                  user_id: session.user.id,
                  design_url: designUrl,
                  wristband_color: d.orderDetails?.wristband_color || "#FFFFFF",
                  wristband_type: d.orderDetails?.wristband_type || "tyvek",
                })
                .select()
                .single();
              
              if (designError) {
                console.error("Design creation error:", designError);
                throw new Error("Failed to create design: " + designError.message);
              }
              
              designId = designData.id;
              console.log("Design created:", designId);
            }
            
            // Create order record
            const orderDetails = d.orderDetails || {};
            const { data: orderData, error: orderError } = await supabase
              .from("orders")
              .insert({
                user_id: session.user.id,
                design_id: designId,
                supplier_id: selectedSupplierId,
                quantity: orderDetails.quantity || 1000,
                total_price: orderDetails.total_price || 0,
                unit_price: orderDetails.unit_price || 0,
                base_price: orderDetails.base_price || 0,
                currency: orderDetails.currency || "EUR",
                print_type: orderDetails.print_type || "none",
                extra_charges: orderDetails.extra_charges || {},
                status: "pending",
                payment_status: "pending",
                has_secure_guests: orderDetails.has_qr_code || false,
              })
              .select()
              .single();
            
            if (orderError) {
              console.error("Order creation error:", orderError);
              throw new Error("Failed to create order: " + orderError.message);
            }
            
            orderId = orderData.id;
            console.log("Order created:", orderId);
          } catch (err: any) {
            console.error("Failed to create order for design:", err);
            throw err;
          }
        }

        orderIds.push(orderId);
      }

      if (orderIds.length === 0) {
        toast.error("No orders found to checkout");
        setLoading(false);
        return;
      }

      console.log("Updating orders:", orderIds);

      // Update ALL orders at once with shipping address and express charges
      const expressValue = state.expressDelivery ? 19 : 0;

      // Fetch all orders to get current totals
      const { data: ordersData, error: fetchOrdersErr } = await supabase
        .from("orders")
        .select("id, extra_charges, total_price")
        .in("id", orderIds);
      
      if (fetchOrdersErr) {
        console.error("Failed to fetch orders:", fetchOrdersErr);
        throw new Error("Failed to fetch orders: " + fetchOrdersErr.message);
      }

      // Update each order individually with merged extras
      for (const order of ordersData || []) {
        const existingExtras = (order.extra_charges && typeof order.extra_charges === 'object') 
          ? order.extra_charges 
          : {};
        
        const newExtras = { ...existingExtras, express: expressValue };
        const currentTotal = order.total_price ? Number(order.total_price) : 0;
        const newTotal = currentTotal + expressValue;

        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            shipping_address: shippingAddress,
            extra_charges: newExtras,
            total_price: newTotal,
          })
          .eq("id", order.id);

        if (updateErr) {
          console.error("Failed to update order", order.id, updateErr);
          throw new Error("Failed to update order: " + updateErr.message);
        }
      }

      console.log("All orders updated. Creating Stripe checkout session for orders:", orderIds);

      // Create Stripe checkout session with ALL order IDs
      console.log("Invoking create-checkout function with orderIds:", orderIds);
      
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-checkout",
        {
          body: { orderIds }, // Send array of all order IDs
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      console.log("Checkout function response:", { checkoutData, checkoutError });

      // Check for function invocation error
      if (checkoutError) {
        console.error("Checkout function invocation error:", checkoutError);
        const errorMsg = checkoutError.message || checkoutError.toString() || "Failed to invoke checkout function";
        throw new Error(`Checkout Error: ${errorMsg}`);
      }

      // Check if response contains an error (function returned error in data)
      if (checkoutData?.error) {
        console.error("Checkout function returned error:", checkoutData.error);
        const details = checkoutData.details ? ` - ${checkoutData.details}` : "";
        throw new Error(`Checkout Failed: ${checkoutData.error}${details}`);
      }

      // Check for checkout URL
      if (!checkoutData?.url) {
        console.error("No checkout URL in response. Full response:", checkoutData);
        throw new Error("No checkout URL returned from payment service");
      }

      console.log("✅ Checkout session created successfully:", checkoutData.sessionId);

      // Update stripe session id on all orders
      try {
        await supabase
          .from("orders")
          .update({ stripe_session_id: checkoutData.sessionId })
          .in("id", orderIds);
      } catch (e) {
        console.warn("Failed to update stripe session id", e);
      }

      // Redirect to Stripe checkout
      toast.success("Redirecting to payment...");
      window.location.href = checkoutData.url;
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "An error occurred while processing your order");
      setLoading(false);
    }
  };

  // Use currency from first design's order details
  const currencySymbol = state.designs?.[0]?.orderDetails?.currency === "USD" 
    ? "$" 
    : state.designs?.[0]?.orderDetails?.currency === "EUR" 
    ? "€" 
    : "£";

  // Calculate total of all designs plus express delivery if selected
  const subtotal = state.designs?.reduce((sum, d) => sum + (d.orderDetails?.total_price || 0), 0) || 0;
  const expressDeliveryFee = state.expressDelivery ? 19 : 0;
  const total = subtotal + expressDeliveryFee;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Shipping Details
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            
            {/* Design Previews */}
            <div className="space-y-4">
              {state.designs?.map((design, idx) => (
                <div key={idx} className="bg-muted rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">Design {idx + 1}</h3>
                  <img 
                    src={design.designUrl} 
                    alt={`Wristband Design ${idx + 1}`} 
                    className="w-full h-auto rounded-lg shadow-lg mb-3"
                  />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-medium">{design.orderDetails?.quantity || 0} pcs</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium capitalize">{design.orderDetails?.wristband_type || "N/A"}</span>
                    </div>
                    {design.orderDetails?.print_type && design.orderDetails.print_type !== "none" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Print:</span>
                        <span className="font-medium capitalize">
                          {design.orderDetails.print_type === "black" ? "Black Print" : "Full Color Print"}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span>Subtotal:</span>
                      <span className="font-medium">{currencySymbol}{(design.orderDetails?.total_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order total */}
            <div className="mt-6 space-y-3 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Express Delivery:</span>
                <span className="font-medium">{currencySymbol}{expressDeliveryFee.toFixed(2)}</span>
              </div>
              {state.expressDelivery && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-4 h-4" />
                  Express delivery selected (2-3 days production)
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary">
                <span>Total:</span>
                <span>{currencySymbol}{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Delivery Address Form */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  value={shippingAddress.name} 
                  onChange={handleInputChange} 
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Street Address *</Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={shippingAddress.address} 
                  onChange={handleInputChange} 
                  className="mt-2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input 
                    id="city" 
                    name="city" 
                    value={shippingAddress.city} 
                    onChange={handleInputChange} 
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input 
                    id="state" 
                    name="state" 
                    value={shippingAddress.state} 
                    onChange={handleInputChange} 
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zipCode">Zip/Postal Code *</Label>
                  <Input 
                    id="zipCode" 
                    name="zipCode" 
                    value={shippingAddress.zipCode} 
                    onChange={handleInputChange} 
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input 
                    id="country" 
                    name="country" 
                    value={shippingAddress.country} 
                    onChange={handleInputChange} 
                    className="mt-2"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  value={shippingAddress.phone} 
                  onChange={handleInputChange} 
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="supplier">Select Supplier *</Label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-md bg-card text-foreground"
                  required
                >
                  <option value="">Choose a supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.company_name}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">Loading suppliers...</p>
                )}
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full mt-4" 
                variant="hero" 
                disabled={loading || !selectedSupplierId}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" /> Proceed to Payment
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Address;
