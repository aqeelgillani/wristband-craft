import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updatePaymentStatus = async () => {
      const sessionId = searchParams.get("session_id");
      
      console.log("PaymentSuccess: session_id from URL:", sessionId);
      
      if (!sessionId) {
        console.error("PaymentSuccess: No session_id in URL");
        setError("No payment session found");
        setLoading(false);
        return;
      }

      try {
        let orderId: string | null = null;
        let paymentStatus = "pending";

        if (sessionId.startsWith("cs_mock_")) {
          console.log("PaymentSuccess: Mock session detected. Simulating successful payment.");
          paymentStatus = "paid";

          // 1. Find the order ID associated with this session ID.
          const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select("id")
            .eq("stripe_session_id", sessionId)
            .single();

          if (orderError || !orderData) {
            console.error("PaymentSuccess: Failed to find order for mock session:", orderError);
            throw new Error("Order not found for mock session.");
          }
          orderId = orderData.id;

          // 2. Manually update order status to 'approved' and payment_status to 'paid'
          const { error: updateError } = await supabase
            .from("orders")
            .update({ status: "approved", payment_status: "paid" })
            .eq("id", orderId);

          if (updateError) {
            console.error("PaymentSuccess: Failed to manually update order status:", updateError);
            throw new Error("Failed to update order status.");
          }
          
        } else {
          // Original logic for real Stripe session
          console.log("PaymentSuccess: Calling update-payment-status with:", sessionId);
          
          // Call edge function to update payment status
          const { data, error: updateError } = await supabase.functions.invoke(
            "update-payment-status",
            {
              body: { sessionId },
            }
          );

          console.log("PaymentSuccess: Response from update-payment-status:", data, updateError);

          if (updateError) {
            console.error("PaymentSuccess: Error from edge function:", updateError);
            throw updateError;
          }

          paymentStatus = data?.paymentStatus;
          orderId = data?.orderId;
        }

        if (paymentStatus === "paid" && orderId) {
          toast.success("Payment successful! Your order has been confirmed.");
          
          console.log("PaymentSuccess: Sending confirmation emails for order:", orderId);
          
          // Send confirmation email to user
          const { error: userEmailError } = await supabase.functions.invoke(
            "send-order-confirmation",
            {
              body: { orderId },
            }
          );

          if (userEmailError) {
            console.error("PaymentSuccess: Error sending user confirmation email:", userEmailError);
          } else {
            console.log("PaymentSuccess: User confirmation email sent successfully");
          }

          // Send notification email to supplier
          const { error: supplierEmailError } = await supabase.functions.invoke(
            "send-supplier-notification",
            {
              body: { orderId },
            }
          );

          if (supplierEmailError) {
            console.error("PaymentSuccess: Error sending supplier notification email:", supplierEmailError);
          } else {
            console.log("PaymentSuccess: Supplier notification email sent successfully");
          }
        } else if (paymentStatus !== "paid") {
          setError("Payment was not successful. Status: " + paymentStatus);
        } else {
          setError("Payment successful, but failed to retrieve order details.");
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("PaymentSuccess: Error in payment status update:", err);
        setError(err.message || "Failed to confirm payment");
        setLoading(false);
      }
    };

    updatePaymentStatus();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg">Confirming your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Payment Verification Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/my-orders")} className="w-full">
              View My Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Your order has been confirmed and is being processed. You will receive a confirmation email shortly.
          </p>
          <div className="space-y-2">
            <Button onClick={() => navigate("/my-orders")} className="w-full" variant="hero">
              View My Orders
            </Button>
            <Button onClick={() => navigate("/design-studio")} variant="outline" className="w-full">
              Create Another Design
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
