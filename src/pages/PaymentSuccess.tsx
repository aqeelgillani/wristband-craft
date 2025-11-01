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
      
      if (!sessionId) {
        setError("No payment session found");
        setLoading(false);
        return;
      }

      try {
        // Call edge function to update payment status
        const { data, error: updateError } = await supabase.functions.invoke(
          "update-payment-status",
          {
            body: { sessionId },
          }
        );

        if (updateError) {
          throw updateError;
        }

        if (data?.paymentStatus === "paid") {
          toast.success("Payment successful! Your order has been confirmed.");
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("Error updating payment status:", err);
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