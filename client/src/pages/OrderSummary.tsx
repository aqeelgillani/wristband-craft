import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, Clock, Calendar, ShieldCheck, Download as DownloadIcon, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [designsInCart, setDesignsInCart] = useState<any[] | null>(null);
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loadingProceed, setLoadingProceed] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const handleDeleteDesign = (idx: number) => {
    if (!designsInCart) return;

    const newDesigns = [...designsInCart];
    newDesigns.splice(idx, 1);
    setDesignsInCart(newDesigns);

    // Update localStorage
    try {
      localStorage.setItem("cart_designs", JSON.stringify(newDesigns));
      toast.success("Design removed from cart");

      // If cart is empty after deletion, redirect to design studio
      if (newDesigns.length === 0) {
        navigate("/design-studio");
      }
    } catch (e) {
      console.error("Failed to update cart in localStorage", e);
      toast.error("Failed to remove design");
    }
  };

  const handleViewDesign = (design: any) => {
    setSelectedDesign(design);
    setViewDialogOpen(true);
  };

  const handleEditDesign = (design: any, designIndex: number) => {
    // Navigate to design studio with the design data and index to restore it
    navigate("/design-studio", {
      state: { editDesign: design, editIndex: designIndex }
    });
  };

  useEffect(() => {
    // If there's no navigation state, check localStorage for saved cart designs.
    // Only redirect back to the design studio when neither is present.
    try {
      const raw = localStorage.getItem("cart_designs");
      const parsed = raw ? JSON.parse(raw) : null;
      const hasLocalCart = Array.isArray(parsed) && parsed.length > 0;

      if (!state && !hasLocalCart) {
        toast.error("Invalid order data");
        navigate("/design-studio");
      }
      // If state exists we let other logic handle missing fields (fallbacks exist)
    } catch (e) {
      // If localStorage read fails, fall back to previous behavior
      if (!state?.orderId || !state?.designUrl) {
        toast.error("Invalid order data");
        navigate("/design-studio");
      }
    }
  }, [state, navigate]);

  useEffect(() => {
    // Load designs created in this browser from localStorage (if any).
    try {
      const raw = localStorage.getItem("cart_designs");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDesignsInCart(parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to read cart designs from localStorage", e);
    }

    // Fallback to single design passed in navigation state
    setDesignsInCart([
      { designUrl: state.designUrl, orderDetails: state.orderDetails, orderId: state.orderId },
    ]);
  }, [state]);

  const downloadTerms = () => {
    const blob = new Blob([
      "Terms and Conditions (dummy)\n\nThese are placeholder terms and conditions. Replace with real document.",
    ], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "terms_and_conditions.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleProceedToAddress = () => {
    if (!termsAccepted) {
      toast.error("Please accept the Terms and Conditions before proceeding");
      return;
    }

    // Ensure we have designs to process
    if (!designsInCart || designsInCart.length === 0) {
      toast.error("Your cart is empty");
      navigate("/design-studio");
      return;
    }

    // Navigate to address entry page (addresses are handled on another page)
    navigate("/address", {
      state: {
        designs: designsInCart,
        expressDelivery,
      },
    });
  };

  // Wait until we know whether we have designs either from navigation state or localStorage
  if (!state && !designsInCart) return null;

  const currencySymbol = state?.orderDetails?.currency === "USD" ? "$" : state?.orderDetails?.currency === "EUR" ? "€" : "£";

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
            
            {/* Designs list (all designs created in this browser or single fallback) */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Designs</h3>
              {designsInCart && designsInCart.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {designsInCart.map((d, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded hover:bg-muted/80 transition-colors">
                      <img 
                        src={d.designUrl} 
                        alt={`Design ${idx + 1}`} 
                        className="w-100 h-8 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleViewDesign(d)}
                      />
                      <div className="flex-1 text-sm">
                        <div className="flex justify-between items-center">
                          <div>{d.orderDetails?.wristband_type || d.wristband_type}</div>
                          <div className="font-medium">{currencySymbol}{(d.orderDetails?.unit_price || d.unit_price || 0).toFixed(2)}</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-muted-foreground">{d.orderDetails?.quantity || d.quantity} pcs</div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDesign(d, idx)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDesign(idx)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No designs found in this browser.</p>
              )}

              {/* Production & Delivery Info */}
              <div className="mt-4 border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Production</div>
                      <div className="text-muted-foreground text-xs">{expressDelivery ? "2 - 3 days" : "3 - 6 days"}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Shipping</div>
                      <div className="text-muted-foreground text-xs">1 day</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Door Delivery</div>
                      <div className="text-muted-foreground text-xs">Same day</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Guarantee</div>
                      <div className="text-muted-foreground text-xs">{expressDelivery ? "max 4 days" : "max 7 days"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Express delivery option */}
              <div className="flex items-center gap-2 mt-3">
                <input id="express" type="checkbox" checked={expressDelivery} onChange={(e) => setExpressDelivery(e.target.checked)} />
                <label htmlFor="express" className="text-sm">Express Delivery (+{currencySymbol}19.00)</label>
              </div>

              {/* Totals summary */}
              <div className="border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">{currencySymbol}{designsInCart?.reduce((sum, d) => sum + ((d.orderDetails?.total_price || d.total_price || 0) ), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Express Fee:</span>
                  <span className="font-medium">{currencySymbol}{expressDelivery ? "19.00" : "0.00"}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary">
                  <span>Total:</span>
                  <span>{currencySymbol}{(designsInCart?.reduce((sum, d) => sum + ((d.orderDetails?.total_price || d.total_price || 0) ), 0) + (expressDelivery ? 19 : 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Next steps: Terms, download, continue to address */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input id="terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                <label htmlFor="terms" className="text-sm">I accept the <strong>Terms and Conditions</strong></label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTerms}>
                  <DownloadIcon className="w-4 h-4 mr-2" /> Download Terms (PDF)
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">Addresses will be collected on the next page.</div>

              <Button
                onClick={handleProceedToAddress}
                disabled={loadingProceed || !designsInCart || designsInCart.length === 0}
                className="w-full mt-6"
                variant="hero"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Continue to Address
              </Button>
            </div>
          </Card>
        </div>
      </main>

      {/* View Design Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Design Preview</DialogTitle>
          </DialogHeader>
          {selectedDesign && (
            <div className="space-y-4">
              <img 
                src={selectedDesign.designUrl} 
                alt="Design preview" 
                className="w-full h-auto rounded-lg"
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 font-medium">{selectedDesign.orderDetails?.wristband_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="ml-2 font-medium">{selectedDesign.orderDetails?.quantity} pcs</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <span className="ml-2 font-medium">{selectedDesign.orderDetails?.wristband_color}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Print:</span>
                  <span className="ml-2 font-medium">{selectedDesign.orderDetails?.print_type || "none"}</span>
                </div>
                {selectedDesign.orderDetails?.trademark_text && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Trademark:</span>
                    <span className="ml-2 font-medium">{selectedDesign.orderDetails.trademark_text}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderSummary;