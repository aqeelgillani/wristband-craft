import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import { Canvas as FabricCanvas, Image as FabricImage } from "fabric";

type Currency = "USD" | "EUR" | "GBP";
type WristbandType = "silicone" | "fabric" | "vinyl" | "tyvek";
type PrintType = "none" | "black" | "full_color";

interface PricingData {
  basePrice: number;
  extraCharges: { blackPrint?: number; fullColorPrint?: number; secureGuests?: number };
  unitPrice: number;
  totalPrice: number;
  minQuantity: number;
}

const DesignStudio = () => {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [uploadedImage, setUploadedImage] = useState<FabricImage | null>(null);
  const [wristbandColor, setWristbandColor] = useState("#FFFFFF");
  const [wristbandType, setWristbandType] = useState<WristbandType>("silicone");
  const [quantity, setQuantity] = useState(1000);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [printType, setPrintType] = useState<PrintType>("none");
  const [hasSecureGuests, setHasSecureGuests] = useState(false);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canvasContainerRef.current || fabricCanvas) return;
    const canvas = new FabricCanvas(canvasContainerRef.current.querySelector("canvas")!, {
      width: 800,
      height: 300,
      backgroundColor: wristbandColor,
    });
    setFabricCanvas(canvas);
    return () => canvas.dispose();
  }, []);

  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas.backgroundColor = wristbandColor;
      fabricCanvas.renderAll();
    }
  }, [wristbandColor, fabricCanvas]);

  useEffect(() => {
    const fetchPricing = async () => {
      if (quantity < 1000) return;
      setLoadingPrice(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-pricing", {
          body: { wristbandType, quantity, currency, printType, hasSecureGuests },
        });
        if (error) throw error;
        setPricing(data);
      } catch (error: any) {
        toast.error(error.message || "Failed to calculate pricing");
      } finally {
        setLoadingPrice(false);
      }
    };
    fetchPricing();
  }, [wristbandType, quantity, currency, printType, hasSecureGuests]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const imgUrl = event.target?.result as string;
      FabricImage.fromURL(imgUrl, { crossOrigin: "anonymous" }).then((img) => {
        img.scaleToWidth(400);
        img.set({
          left: fabricCanvas.width! / 2 - img.getScaledWidth() / 2,
          top: fabricCanvas.height! / 2 - img.getScaledHeight() / 2,
        });
        if (uploadedImage) fabricCanvas.remove(uploadedImage);
        fabricCanvas.add(img);
        setUploadedImage(img);
        fabricCanvas.renderAll();
        toast.success("Design uploaded successfully");
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePlaceOrder = async () => {
    if (!fabricCanvas || fabricCanvas.getObjects().length === 0) {
      toast.error("Please upload your design first");
      return;
    }
    if (quantity < 1000) {
      toast.error("Minimum quantity is 1000 pieces");
      return;
    }
    if (!pricing) {
      toast.error("Please wait for pricing to load");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to place order");
        navigate("/auth");
        return;
      }

      const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `${session.user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from("wristband-designs").upload(fileName, blob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("wristband-designs").getPublicUrl(fileName);
      const { data: design, error: designError } = await supabase.from("designs").insert({
        user_id: session.user.id,
        design_url: publicUrl,
        wristband_color: wristbandColor,
        wristband_type: wristbandType,
      }).select().single();
      if (designError) throw designError;

      const { data: order, error: orderError } = await supabase.from("orders").insert({
        user_id: session.user.id,
        design_id: design.id,
        quantity,
        total_price: pricing.totalPrice,
        unit_price: pricing.unitPrice,
        base_price: pricing.basePrice,
        currency,
        print_type: printType,
        has_secure_guests: hasSecureGuests,
        extra_charges: pricing.extraCharges,
        status: "pending",
      }).select().single();
      if (orderError) throw orderError;

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { orderId: order.id },
      });
      if (checkoutError || !checkoutData?.url) throw new Error("Failed to create checkout");

      await supabase.from("orders").update({ stripe_session_id: checkoutData.sessionId }).eq("id", order.id);
      window.open(checkoutData.url, "_blank");
      toast.success("Redirecting to checkout...");
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            EU Wristbands - Design Studio
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Design Preview</h2>
            <div ref={canvasContainerRef} className="bg-muted rounded-lg p-8 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.1)" }}>
              <div style={{ transform: "perspective(1000px) rotateX(-5deg) rotateY(2deg)", transformStyle: "preserve-3d", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                <canvas className="rounded-lg" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Configure Your Wristband</h2>
            <div className="space-y-6">
              <div>
                <Label>Quantity (Min 1000 pcs)</Label>
                <Input type="number" min="1000" step="100" value={quantity} onChange={(e) => setQuantity(Math.max(1000, parseInt(e.target.value) || 1000))} className="mt-2" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(v: Currency) => setCurrency(v)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Wristband Type</Label>
                <Select value={wristbandType} onValueChange={(v: WristbandType) => setWristbandType(v)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silicone">Silicone</SelectItem>
                    <SelectItem value="fabric">Fabric</SelectItem>
                    <SelectItem value="vinyl">Vinyl</SelectItem>
                    <SelectItem value="tyvek">Tyvek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Wristband Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input type="color" value={wristbandColor} onChange={(e) => setWristbandColor(e.target.value)} className="w-20 h-10" />
                  <Input type="text" value={wristbandColor} onChange={(e) => setWristbandColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="black-print" checked={printType === "black"} onCheckedChange={(c) => setPrintType(c ? "black" : "none")} />
                  <Label htmlFor="black-print" className="cursor-pointer">Black Print {pricing?.extraCharges.blackPrint && `(+${currencySymbol}${pricing.extraCharges.blackPrint.toFixed(2)})`}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="full-color" checked={printType === "full_color"} onCheckedChange={(c) => setPrintType(c ? "full_color" : "none")} />
                  <Label htmlFor="full-color" className="cursor-pointer">Full Color Print {pricing?.extraCharges.fullColorPrint && `(+${currencySymbol}${pricing.extraCharges.fullColorPrint.toFixed(2)})`}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="secure-guests" checked={hasSecureGuests} onCheckedChange={(c) => setHasSecureGuests(c as boolean)} />
                  <Label htmlFor="secure-guests" className="cursor-pointer">Secure Guests {pricing?.extraCharges.secureGuests && `(+${currencySymbol}${pricing.extraCharges.secureGuests.toFixed(2)})`}</Label>
                </div>
              </div>
              <div>
                <Label>Upload Your Design</Label>
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="mt-2" />
              </div>
              <div className="bg-secondary/20 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-lg mb-3">Order Summary</h3>
                {loadingPrice ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : pricing ? (
                  <>
                    <div className="flex justify-between text-sm"><span>Base Price:</span><span>{currencySymbol}{pricing.basePrice.toFixed(2)} / unit</span></div>
                    {pricing.extraCharges.blackPrint && <div className="flex justify-between text-sm"><span>Black Print:</span><span>+{currencySymbol}{pricing.extraCharges.blackPrint.toFixed(2)} / unit</span></div>}
                    {pricing.extraCharges.fullColorPrint && <div className="flex justify-between text-sm"><span>Full Color Print:</span><span>+{currencySymbol}{pricing.extraCharges.fullColorPrint.toFixed(2)} / unit</span></div>}
                    {pricing.extraCharges.secureGuests && <div className="flex justify-between text-sm"><span>Secure Guests:</span><span>+{currencySymbol}{pricing.extraCharges.secureGuests.toFixed(2)} / unit</span></div>}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-medium"><span>Unit Price:</span><span>{currencySymbol}{pricing.unitPrice.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span>Quantity:</span><span>{quantity} pcs</span></div>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary"><span>Total:</span><span>{currencySymbol}{pricing.totalPrice.toFixed(2)}</span></div>
                  </>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Enter quantity to see pricing</p>}
              </div>
              <Button onClick={handlePlaceOrder} disabled={saving || !pricing || !fabricCanvas?.getObjects().length} variant="hero" className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {pricing ? `Checkout ${currencySymbol}${pricing.totalPrice.toFixed(2)}` : "Place Order"}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DesignStudio;
