import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, Save, ShoppingCart, Crop, RotateCw } from "lucide-react";
import { Canvas as FabricCanvas, Image as FabricImage, IText } from "fabric";

const WRISTBAND_PRICES = {
  silicone: 2.99,
  fabric: 3.99,
  vinyl: 3.49,
  tyvek: 1.99,
};

const DesignStudio = () => {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [uploadedImage, setUploadedImage] = useState<FabricImage | null>(null);
  const [wristbandColor, setWristbandColor] = useState("#FFFFFF");
  const [wristbandType, setWristbandType] = useState<keyof typeof WRISTBAND_PRICES>("silicone");
  const [customText, setCustomText] = useState("");
  const [textColor, setTextColor] = useState("#000000");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canvasContainerRef.current || fabricCanvas) return;

    const canvas = new FabricCanvas(canvasContainerRef.current.querySelector("canvas")!, {
      width: 800,
      height: 300,
      backgroundColor: wristbandColor,
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas.backgroundColor = wristbandColor;
      fabricCanvas.renderAll();
    }
  }, [wristbandColor, fabricCanvas]);

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
      
      FabricImage.fromURL(imgUrl, {
        crossOrigin: "anonymous",
      }).then((img) => {
        img.scaleToWidth(400);
        img.set({
          left: fabricCanvas.width! / 2 - img.getScaledWidth() / 2,
          top: fabricCanvas.height! / 2 - img.getScaledHeight() / 2,
        });
        
        if (uploadedImage) {
          fabricCanvas.remove(uploadedImage);
        }
        
        fabricCanvas.add(img);
        setUploadedImage(img);
        fabricCanvas.renderAll();
        toast.success("Image uploaded successfully");
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddText = () => {
    if (!fabricCanvas || !customText) return;

    const text = new IText(customText, {
      left: fabricCanvas.width! / 2,
      top: fabricCanvas.height! / 2,
      fill: textColor,
      fontSize: 32,
      fontFamily: "Arial",
      fontWeight: "bold",
    });

    fabricCanvas.add(text);
    fabricCanvas.renderAll();
  };

  const handleRotate = () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + 45);
      fabricCanvas.renderAll();
    } else {
      toast.info("Select an object first");
    }
  };

  const handleSaveDesign = async () => {
    if (!fabricCanvas) {
      toast.error("Canvas not initialized");
      return;
    }

    const objects = fabricCanvas.getObjects();
    if (objects.length === 0) {
      toast.error("Please add a design or text");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to save designs");
        navigate("/auth");
        return;
      }

      // Export canvas as image
      const dataUrl = fabricCanvas.toDataURL({ 
        format: "png", 
        quality: 1,
        multiplier: 2,
      });
      const blob = await (await fetch(dataUrl)).blob();

      // Upload to storage
      const fileName = `${session.user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("wristband-designs")
        .upload(fileName, blob);

      if (uploadError) {
        toast.error("Failed to upload design");
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("wristband-designs")
        .getPublicUrl(fileName);

      // Save to database
      const { data: design, error: dbError } = await supabase.from("designs").insert({
        user_id: session.user.id,
        design_url: publicUrl,
        wristband_color: wristbandColor,
        wristband_type: wristbandType,
        custom_text: customText,
        text_color: textColor,
      }).select().single();

      if (dbError) {
        toast.error("Failed to save design");
        return;
      }

      toast.success("Design saved successfully!");
      return design.id;
    } catch (error) {
      toast.error("An error occurred");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!fabricCanvas || fabricCanvas.getObjects().length === 0) {
      toast.error("Please create a design first");
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

      // Save design first
      const designId = await handleSaveDesign();
      if (!designId) return;

      const totalPrice = WRISTBAND_PRICES[wristbandType] * quantity;

      // Create order in database
      const { data: order, error: orderError } = await supabase.from("orders").insert({
        user_id: session.user.id,
        design_id: designId,
        quantity: quantity,
        total_price: totalPrice,
        unit_price: WRISTBAND_PRICES[wristbandType],
        status: "pending",
      }).select().single();

      if (orderError) {
        toast.error("Failed to create order");
        return;
      }

      // Create Stripe checkout session
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { orderId: order.id, quantity, wristbandType },
      });

      if (checkoutError || !checkoutData?.url) {
        toast.error("Failed to create checkout session");
        return;
      }

      // Update order with session ID
      await supabase.from("orders").update({
        stripe_session_id: checkoutData.sessionId,
      }).eq("id", order.id);

      // Redirect to Stripe checkout
      window.open(checkoutData.url, "_blank");
      toast.success("Redirecting to checkout...");
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const unitPrice = WRISTBAND_PRICES[wristbandType];
  const totalPrice = unitPrice * quantity;

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
          {/* 3D Preview */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">3D Wristband Preview</h2>
            <div 
              ref={canvasContainerRef}
              className="bg-muted rounded-lg p-8 flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{
                transform: "perspective(1000px) rotateX(-5deg) rotateY(2deg)",
                transformStyle: "preserve-3d",
                boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
                borderRadius: "8px",
              }}>
                <canvas className="rounded-lg" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRotate}>
                <RotateCw className="h-4 w-4 mr-2" />
                Rotate Object
              </Button>
            </div>
          </Card>

          {/* Controls */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Design Controls</h2>
            <div className="space-y-6">
              <div>
                <Label htmlFor="wristband-type">Wristband Type</Label>
                <Select value={wristbandType} onValueChange={(value: any) => setWristbandType(value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silicone">Silicone - ${WRISTBAND_PRICES.silicone}</SelectItem>
                    <SelectItem value="fabric">Fabric - ${WRISTBAND_PRICES.fabric}</SelectItem>
                    <SelectItem value="vinyl">Vinyl - ${WRISTBAND_PRICES.vinyl}</SelectItem>
                    <SelectItem value="tyvek">Tyvek - ${WRISTBAND_PRICES.tyvek}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="image-upload">Upload Design</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="wristband-color">Wristband Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="wristband-color"
                    type="color"
                    value={wristbandColor}
                    onChange={(e) => setWristbandColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={wristbandColor}
                    onChange={(e) => setWristbandColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="custom-text">Custom Text</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="custom-text"
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Enter your text"
                    maxLength={30}
                    className="flex-1"
                  />
                  <Button onClick={handleAddText} size="sm" variant="outline">
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="text-color">Text Color</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="text-color"
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-2"
                />
              </div>

              <div className="bg-secondary/20 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Unit Price:</span>
                  <span className="font-semibold">${unitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Quantity:</span>
                  <span className="font-semibold">{quantity}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-primary">${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveDesign} disabled={saving} variant="secondary" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Design
                </Button>
                <Button onClick={handlePlaceOrder} disabled={saving} variant="hero" className="flex-1">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Place Order ${totalPrice.toFixed(2)}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DesignStudio;
