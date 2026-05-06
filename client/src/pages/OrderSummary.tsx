import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, Clock, Calendar, ShieldCheck, Download as DownloadIcon, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OrderSummary = () => {
  const navigate = useNavigate();

  const [draftOrders, setDraftOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expressDelivery, setExpressDelivery] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loadingProceed, setLoadingProceed] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    const loadDraftOrders = async () => {
      try {
        const orders: any[] = await apiFetch("/orders/mine");
        const drafts = (orders || []).filter((o: any) => o.status === "DRAFT");
        setDraftOrders(drafts);
        if (drafts.length === 0) {
          toast.error("Your cart is empty");
          navigate("/design-studio");
        }
      } catch {
        toast.error("Failed to load cart");
        navigate("/design-studio");
      } finally {
        setLoading(false);
      }
    };
    loadDraftOrders();
  }, [navigate]);

  const handleDeleteDesign = async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}`, { method: "DELETE" });
      const remaining = draftOrders.filter(o => o.id !== orderId);
      setDraftOrders(remaining);
      toast.success("Design removed from cart");
      if (remaining.length === 0) navigate("/design-studio");
    } catch {
      toast.error("Failed to remove design");
    }
  };

  const handleViewDesign = (order: any) => {
    setSelectedDesign(order);
    setViewDialogOpen(true);
  };

  const handleEditDesign = (order: any) => {
    const notes = order.customizationNotes ? JSON.parse(order.customizationNotes) : {};
    navigate("/design-studio", {
      state: {
        editDesign: {
          orderDetails: {
            wristband_color: notes.wristband_color || "#FFFFFF",
            wristband_type: order.wristbandType || "tyvek",
            quantity: order.quantity,
            print_type: order.printType || "none",
            has_trademark: notes.has_trademark || false,
            trademark_text: notes.trademark_text || "",
            trademark_text_color: notes.trademark_text_color || "black",
            has_qr_code: notes.has_qr_code || false,
            has_print: notes.has_print || false,
            supplierId: order.supplierId,
          },
          designUrl: order.design?.designUrl,
          designId: order.designId,
        },
        editOrderId: order.id,
      },
    });
  };

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
    if (draftOrders.length === 0) {
      toast.error("Your cart is empty");
      navigate("/design-studio");
      return;
    }
    navigate("/address", {
      state: { orderIds: draftOrders.map(o => o.id), expressDelivery },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currency = draftOrders[0]?.currency || "EUR";
  const currencySymbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";

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
            
            {/* Designs list */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Designs ({draftOrders.length})</h3>
              <div className="grid grid-cols-1 gap-3">
                {draftOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-3 bg-muted rounded hover:bg-muted/80 transition-colors">
                    {order.design?.designUrl && (
                      <img
                        src={order.design.designUrl}
                        alt="Design"
                        className="w-100 h-8 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleViewDesign(order)}
                      />
                    )}
                    <div className="flex-1 text-sm">
                      <div className="flex justify-between items-center">
                        <div>{order.wristbandType || "—"}</div>
                        <div className="font-medium">{currencySymbol}{(order.unitPrice || 0).toFixed(3)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-muted-foreground">{order.quantity} pcs</div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditDesign(order)} className="text-primary hover:text-primary hover:bg-primary/10">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteDesign(order.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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
                  <span className="font-medium">{currencySymbol}{draftOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Express Fee:</span>
                  <span className="font-medium">{currencySymbol}{expressDelivery ? "19.00" : "0.00"}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary">
                  <span>Total:</span>
                  <span>{currencySymbol}{(draftOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0) + (expressDelivery ? 19 : 0)).toFixed(2)}</span>
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
                disabled={loadingProceed || draftOrders.length === 0}
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
          {selectedDesign && (() => {
            const notes = selectedDesign.customizationNotes
              ? JSON.parse(selectedDesign.customizationNotes)
              : {};
            return (
              <div className="space-y-4">
                {selectedDesign.design?.designUrl && (
                  <img src={selectedDesign.design.designUrl} alt="Design preview" className="w-full h-auto rounded-lg" />
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Type:</span><span className="ml-2 font-medium">{selectedDesign.wristbandType}</span></div>
                  <div><span className="text-muted-foreground">Quantity:</span><span className="ml-2 font-medium">{selectedDesign.quantity} pcs</span></div>
                  <div><span className="text-muted-foreground">Print:</span><span className="ml-2 font-medium">{selectedDesign.printType || "none"}</span></div>
                  {notes.trademark_text && (
                    <div className="col-span-2"><span className="text-muted-foreground">Trademark:</span><span className="ml-2 font-medium">{notes.trademark_text}</span></div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderSummary;