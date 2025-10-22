import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

interface LocationState {
  orderId: string;
  designUrl: string;
  orderDetails: any;
}

const OrderSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
  });

  useEffect(() => {
    if (!state?.orderId || !state?.designUrl) {
      toast.error("Invalid order data");
      navigate("/design-studio");
    }
  }, [state, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
  };

  const handleProceedToPayment = async () => {
    if (!shippingAddress.name || !shippingAddress.address || !shippingAddress.city || !shippingAddress.zipCode || !shippingAddress.country) {
      toast.error("Please fill in all required address fields");
      return;
    }

    setLoading(true);
    try {
      // Update order with shipping address
      const { error: updateError } = await supabase
        .from("orders")
        .update({ shipping_address: shippingAddress })
        .eq("id", state.orderId);

      if (updateError) throw updateError;

      // Create Stripe checkout session
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { orderId: state.orderId },
      });

      if (checkoutError || !checkoutData?.url) throw new Error("Failed to create checkout");

      // Update order with stripe session id
      await supabase.from("orders").update({ stripe_session_id: checkoutData.sessionId }).eq("id", state.orderId);

      // Send admin notification about new order
      try {
        await supabase.functions.invoke("send-admin-notification", {
          body: { orderId: state.orderId },
        });
      } catch (notificationError) {
        console.error("Failed to send admin notification:", notificationError);
      }

      window.open(checkoutData.url, "_blank");
      toast.success("Redirecting to checkout...");
      
      // Navigate to my orders after a delay
      setTimeout(() => navigate("/my-orders"), 2000);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!state?.orderId) return null;

  const currencySymbol = state.orderDetails?.currency === "USD" ? "$" : state.orderDetails?.currency === "EUR" ? "€" : "£";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/design-studio")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Order Summary
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Order</h2>
            
            {/* Design Preview */}
            <div className="mb-6 bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Design Preview</h3>
              <img 
                src={state.designUrl} 
                alt="Wristband Design" 
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>

            {/* Order Details */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-medium">{state.orderDetails?.quantity} pcs</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wristband Type:</span>
                <span className="font-medium capitalize">{state.orderDetails?.wristband_type}</span>
              </div>
              {state.orderDetails?.print_type && state.orderDetails.print_type !== "none" && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Print Type:</span>
                  <span className="font-medium capitalize">{state.orderDetails.print_type === "black" ? "Black Print" : "Full Color Print"}</span>
                </div>
              )}
              {state.orderDetails?.has_secure_guests && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Secure Guests:</span>
                  <span className="font-medium">Yes</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="font-medium">{currencySymbol}{state.orderDetails?.unit_price?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary">
                <span>Total:</span>
                <span>{currencySymbol}{state.orderDetails?.total_price?.toFixed(2)}</span>
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
                  placeholder="John Doe"
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
                  placeholder="123 Main Street, Apt 4B"
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
                    placeholder="New York"
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
                    placeholder="NY"
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
                    placeholder="10001"
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
                    placeholder="United States"
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
                  type="tel"
                  value={shippingAddress.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  className="mt-2"
                />
              </div>
              <Button
                onClick={handleProceedToPayment}
                disabled={loading}
                className="w-full mt-6"
                variant="hero"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Proceed to Payment
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

export default OrderSummary;
