import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Loader2, Save, Download, Printer, Trash2, Plus } from "lucide-react";
import { Canvas as FabricCanvas, Image as FabricImage, IText, Line, Rect } from "fabric";

type Currency = "EUR";
type WristbandType = "silicone" | "fabric" | "vinyl" | "tyvek";
type PrintType = "none" | "print";

const TYVEK_COLORS = [
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
  { name: "Silver", value: "#C0C0C0" },
  { name: "Yellow", value: "#FFFF00" },
  { name: "Neon Yellow", value: "#DFFF00" },
  { name: "Gold", value: "#FFD700" },
  { name: "Red", value: "#FF0000" },
  { name: "Neon Red", value: "#FF073A" },
  { name: "Orange", value: "#FF8C00" },
  { name: "Neon Green", value: "#39FF14" },
  { name: "Green", value: "#00FF00" },
  { name: "Sky Blue", value: "#87CEEB" },
  { name: "Blue", value: "#0000FF" },
  { name: "Aqua", value: "#00FFFF" },
  { name: "Purple", value: "#800080" },
  { name: "Pink", value: "#FF69B4" },
  { name: "Magenta", value: "#FF00FF" },
  { name: "Violet", value: "#8B00FF" },
];

interface PricingData {
  basePrice: number;
  extraCharges: { print?: number; trademark?: number; qrCode?: number };
  unitPrice: number;
  totalPrice: number;
  minQuantity: number;
}

interface SavedTemplate {
  id: string;
  design_url: string;
  wristband_color: string;
  wristband_type: string;
  created_at: string;
}

const DesignStudio = () => {
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [uploadedImage, setUploadedImage] = useState<FabricImage | null>(null);
  const [customText, setCustomText] = useState("");
  const [wristbandColor, setWristbandColor] = useState("#FFFFFF");
  const [wristbandType, setWristbandType] = useState<WristbandType>("tyvek");
  const [quantity, setQuantity] = useState(1000);
  const [currency] = useState<Currency>("EUR");
  const [printType, setPrintType] = useState<PrintType>("none");
  const [hasTrademark, setHasTrademark] = useState(false);
  const [hasQrCode, setHasQrCode] = useState(false);
  const [trademarkText, setTrademarkText] = useState("");
  const [trademarkTextColor, setTrademarkTextColor] = useState<"white" | "black">("black");
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [trademarkTextObj, setTrademarkTextObj] = useState<IText | null>(null);
  const [qrPlaceholder, setQrPlaceholder] = useState<Rect | null>(null);

  useEffect(() => {
    if (!canvasContainerRef.current || fabricCanvas) return;
    const canvas = new FabricCanvas(canvasContainerRef.current.querySelector("canvas")!, {
      width: 1200,
      height: 100,
      backgroundColor: wristbandColor,
    });
    
    // Add left white space for QR (90px wide with rounded appearance)
    const qrWhiteSpace = new Rect({
      left: 0,
      top: 0,
      width: 90,
      height: 100,
      fill: '#FFFFFF',
      selectable: false,
      evented: false,
      rx: 10, // Rounded corner on left
      ry: 10,
    });
    
    // Add right white space for closing end (50px wide)
    const closingWhiteSpace = new Rect({
      left: 1150,
      top: 0,
      width: 50,
      height: 100,
      fill: '#FFFFFF',
      selectable: false,
      evented: false,
    });
    
    // Add diecut lines (in the middle design area)
    const diecutMargin = 100;
    const topLine = new Line([diecutMargin, 8, 1150, 8], {
      stroke: '#666666',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });
    const bottomLine = new Line([diecutMargin, 92, 1150, 92], {
      stroke: '#666666',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });
    
    canvas.add(qrWhiteSpace, closingWhiteSpace, topLine, bottomLine);
    canvas.sendObjectToBack(closingWhiteSpace);
    canvas.sendObjectToBack(qrWhiteSpace);
    setFabricCanvas(canvas);
    
    // Load saved templates
    loadTemplates();
    
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

  const loadTemplates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setSavedTemplates(data || []);
    } catch (error: any) {
      console.error("Failed to load templates:", error);
    }
  };

  useEffect(() => {
    const fetchPricing = async () => {
      if (quantity < 1000) return;
      setLoadingPrice(true);
      try {
        // Base price is 39€ for 1000pcs regardless of print
        const basePrice = 0.039; // 39€ / 1000 = 0.039€ per unit
        const extraCharges: any = {};
        
        if (hasTrademark) {
          extraCharges.trademark = 15 / 1000; // 15€ per 1000 bands
        }
        if (hasQrCode) {
          extraCharges.qrCode = 15 / 1000; // 15€ per 1000 bands
        }
        
        const unitPrice = basePrice + (extraCharges.trademark || 0) + (extraCharges.qrCode || 0);
        const totalPrice = unitPrice * quantity;
        
        setPricing({
          basePrice,
          extraCharges,
          unitPrice,
          totalPrice,
          minQuantity: 1000,
        });
      } catch (error: any) {
        toast.error(error.message || "Failed to calculate pricing");
      } finally {
        setLoadingPrice(false);
      }
    };
    fetchPricing();
  }, [wristbandType, quantity, printType, hasTrademark, hasQrCode]);

  // Update trademark text on canvas (vertical and rotatable)
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Remove existing trademark text
    if (trademarkTextObj) {
      fabricCanvas.remove(trademarkTextObj);
      setTrademarkTextObj(null);
    }
    
    // Add new trademark text if enabled (vertical and rotatable)
    if (hasTrademark && trademarkText.trim()) {
      const text = new IText(trademarkText, {
        left: 430, // Center of design area: 90 + (1080 / 2)
        top: 50,
        fontSize: 18,
        fill: trademarkTextColor === "white" ? "#FFFFFF" : "#000000",
        fontFamily: "Arial",
        fontWeight: 'light',
        originX: 'center',
        originY: 'center',
        angle: 90, // Rotate 90 degrees for vertical text
        lockRotation: false, // Allow rotation
      });
      
      fabricCanvas.add(text);
      setTrademarkTextObj(text);
      fabricCanvas.renderAll();
    }
  }, [hasTrademark, trademarkText, trademarkTextColor, fabricCanvas]);

  // Update QR placeholder on canvas (fills the left white area vertically)
  useEffect(() => {
    if (!fabricCanvas) return;
    
    // Remove existing QR placeholder
    if (qrPlaceholder) {
      fabricCanvas.remove(qrPlaceholder);
      setQrPlaceholder(null);
    }
    
    // Add QR placeholder if enabled (in the white left area)
    if (hasQrCode) {
      const qrRect = new Rect({
        left: 10,
        top: 15,
        width: 70,
        height: 70,
        fill: "#FFFFFF",
        stroke: "#00AA00",
        strokeWidth: 3,
        selectable: false,
        evented: false,
        rx: 5,
        ry: 5,
      });
      
      // Add "QR" text inside
      const qrText = new IText("QR", {
        left: 45,
        top: 50,
        fontSize: 16,
        fill: "#00AA00",
        fontFamily: "Arial",
        fontWeight: "bold",
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      
      fabricCanvas.add(qrRect, qrText);
      fabricCanvas.bringObjectToFront(qrRect);
      fabricCanvas.bringObjectToFront(qrText);
      setQrPlaceholder(qrRect);
      fabricCanvas.renderAll();
    }
  }, [hasQrCode, fabricCanvas]);

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
        // Scale to fit within the design area (between diecut lines)
        const maxWidth = 300; // Reasonable size for logos
        const maxHeight = 60; // Fits within diecut lines (84px - margins)
        
        if (img.width! > maxWidth) {
          img.scaleToWidth(maxWidth);
        }
        if (img.getScaledHeight() > maxHeight) {
          img.scaleToHeight(maxHeight);
        }
        
        // Position in the design area with proper clipping
        img.set({
          left: 625 - (img.getScaledWidth() / 2), // Center horizontally in design area (100 + 1050/2)
          top: 50 - (img.getScaledHeight() / 2), // Center vertically
          clipPath: new Rect({
            left: 100,
            top: 8,
            width: 1050,
            height: 84,
            absolutePositioned: true,
          }),
        });
        
        fabricCanvas.add(img);
        setUploadedImage(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
        toast.success("Logo uploaded! Select and click 'Duplicate Logo' to add more");
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddText = () => {
    if (!fabricCanvas || !customText.trim()) {
      toast.error("Please enter text to add");
      return;
    }

    const text = new IText(customText, {
      left: 625, // Center of design area: 100 + (1050 / 2)
      top: 50,
      fontSize: 24,
      fill: "#000000",
      fontFamily: "Arial",
      originX: 'center',
      fontWeight: 'bold', 
      originY: 'center',
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    setCustomText("");
    toast.success("Text added to design");
  };

  const handleDuplicateLogo = () => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'image') {
      const img = activeObject as FabricImage;
      const imgElement = img.getElement() as HTMLImageElement;
      
      FabricImage.fromURL(imgElement.src, { crossOrigin: "anonymous" }).then((cloned) => {
        cloned.set({
          left: img.left! + 30,
          top: img.top! + 30,
          scaleX: img.scaleX,
          scaleY: img.scaleY,
          angle: img.angle,
          clipPath: new Rect({
            left: 100,
            top: 8,
            width: 1050,
            height: 84,
            absolutePositioned: true,
          }),
        });
        fabricCanvas.add(cloned);
        fabricCanvas.setActiveObject(cloned);
        fabricCanvas.renderAll();
        toast.success("Logo duplicated! Drag to reposition");
      });
    } else {
      toast.error("Select a logo to duplicate");
    }
  };

  const handleSaveTemplate = async () => {
    if (!fabricCanvas) return;
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please sign in to save templates");
        navigate("/auth");
        return;
      }

      const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `templates/${session.user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from("wristband-designs").upload(fileName, blob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("wristband-designs").getPublicUrl(fileName);
      
      const { error: designError } = await supabase.from("designs").insert({
        user_id: session.user.id,
        design_url: publicUrl,
        wristband_color: wristbandColor,
        wristband_type: wristbandType,
        custom_text: trademarkText || "",
        text_color: trademarkTextColor === "white" ? "#FFFFFF" : "#000000",
      });
      if (designError) {
        console.error("Design insert error:", designError);
        throw designError;
      }

      toast.success("Template saved successfully");
      loadTemplates();
    } catch (error: any) {
      console.error("Save template error:", error);
      toast.error(error.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase.from("designs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template deleted");
      loadTemplates();
    } catch (error: any) {
      toast.error("Failed to delete template");
    }
  };

  const handleDownloadPDF = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `wristband-design-${Date.now()}.png`;
    link.click();
    toast.success("Design downloaded");
  };

  const handlePrint = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<img src="${dataUrl}" onload="window.print();window.close()" />`);
    }
  };

  const handlePlaceOrder = async () => {
    if (!fabricCanvas) {
      toast.error("Please create a design");
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
        extra_charges: pricing.extraCharges,
        status: "pending",
        admin_notes: `Trademark: ${hasTrademark ? trademarkText : "No"}, QR Code: ${hasQrCode ? "Yes" : "No"}`,
      }).select().single();
      if (orderError) throw orderError;

      // Navigate to order summary page
      navigate("/order-summary", {
        state: {
          orderId: order.id,
          designUrl: publicUrl,
          orderDetails: {
            quantity,
            total_price: pricing.totalPrice,
            unit_price: pricing.unitPrice,
            currency,
            wristband_type: wristbandType,
            print_type: printType,
            has_trademark: hasTrademark,
            trademark_text: trademarkText,
            has_qr_code: hasQrCode,
          },
        },
      });
      toast.success("Proceeding to order summary...");
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = "€";

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
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Design Preview</h2>
                <p className="text-sm text-muted-foreground">Left white area: QR space | Middle: Design area | Right white: Closing end</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div ref={canvasContainerRef} className="bg-muted rounded-lg p-8 flex items-center justify-center " style={{ background: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.1)" }}>
              <div style={{ transform: "perspective(1000px) rotateX(-5deg)", transformStyle: "preserve-3d", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", borderRadius: "4px" }}>
                <canvas className="rounded" />
              </div>
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDuplicateLogo}
              >
                <Plus className="h-4 w-4 mr-2" />
                Duplicate Logo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (fabricCanvas) {
                    const objects = fabricCanvas.getObjects().filter(obj => obj.selectable !== false);
                    fabricCanvas.remove(...objects);
                    setUploadedImage(null);
                    toast.success("Canvas cleared");
                  }
                }}
              >
                Clear Canvas
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const activeObject = fabricCanvas?.getActiveObject();
                  if (activeObject) {
                    fabricCanvas?.remove(activeObject);
                    toast.success("Object removed");
                  } else {
                    toast.error("Select an object to delete");
                  }
                }}
              >
                Delete Selected
              </Button>
            </div>
            
            {savedTemplates.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Saved Templates</h3>
                <div className="grid grid-cols-2 gap-3">
                  {savedTemplates.map((template) => (
                    <div 
                      key={template.id} 
                      className="relative group border rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => {
                        // Load template into canvas
                        if (!fabricCanvas) return;
                        FabricImage.fromURL(template.design_url, { crossOrigin: "anonymous" }).then((img) => {
                          // Clear canvas first
                          const objects = fabricCanvas.getObjects().filter(obj => obj.selectable !== false);
                          fabricCanvas.remove(...objects);
                          setUploadedImage(null);
                          
                          // Add template image
                          img.scaleToWidth(fabricCanvas.width!);
                          fabricCanvas.add(img);
                          fabricCanvas.renderAll();
                          
                          // Update settings
                          setWristbandColor(template.wristband_color);
                          setWristbandType(template.wristband_type as WristbandType);
                          toast.success("Template loaded");
                        });
                      }}
                    >
                      <img src={template.design_url} alt="Template" className="w-full h-20 object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                          className="text-white hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Configure Your Wristband</h2>
            <div className="space-y-6">
              <div>
                <Label>Quantity (Min 1000 pcs)</Label>
                <Input type="number" min="1000" step="100" value={quantity} onChange={(e) => setQuantity(Math.max(1000, parseInt(e.target.value) || 1000))} className="mt-2" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Save current design and open new one
                    const confirmNew = window.confirm("Create a new design with different quantity or print options? Current design will be saved if you proceed to checkout.");
                    if (confirmNew) {
                      window.open("/design-studio", "_blank");
                      toast.success("New design tab opened");
                    }
                  }}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Design (Different Quantity/Prints)
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Use this when you need different quantities or print options for a new design</p>
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
              {wristbandType === "tyvek" && (
                <div>
                  <Label>Tyvek Color</Label>
                  <div className="grid grid-cols-9 gap-2 mt-2">
                    {TYVEK_COLORS.map((color) => (
                      <button
                        key={color.value}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          wristbandColor === color.value ? "border-primary scale-110" : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setWristbandColor(color.value)}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {wristbandType !== "tyvek" && (
                <div>
                  <Label>Wristband Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input type="color" value={wristbandColor} onChange={(e) => setWristbandColor(e.target.value)} className="w-20 h-10" />
                    <Input type="text" value={wristbandColor} onChange={(e) => setWristbandColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="print" checked={printType === "print"} onCheckedChange={(c) => setPrintType(c ? "print" : "none")} />
                  <Label htmlFor="print" className="cursor-pointer">Add Print (included in base price)</Label>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="trademark" checked={hasTrademark} onCheckedChange={(c) => setHasTrademark(c as boolean)} />
                    <Label htmlFor="trademark" className="cursor-pointer">Add Trademark Text (15€ per 1000 bands)</Label>
                  </div>
                  {hasTrademark && (
                    <div className="ml-6 space-y-2">
                      <Input
                        type="text"
                        maxLength={15}
                        value={trademarkText}
                        onChange={(e) => setTrademarkText(e.target.value)}
                        placeholder="Web address (max 15 letters)"
                      />
                      <div className="flex items-center gap-4">
                        <Label>Text Color:</Label>
                        <RadioGroup value={trademarkTextColor} onValueChange={(v) => setTrademarkTextColor(v as "white" | "black")} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="white" id="white" />
                            <Label htmlFor="white" className="cursor-pointer">White</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="black" id="black" />
                            <Label htmlFor="black" className="cursor-pointer">Black</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="qr-code" checked={hasQrCode} onCheckedChange={(c) => setHasQrCode(c as boolean)} />
                  <Label htmlFor="qr-code" className="cursor-pointer">Add QR Code - Emergency (15€ per 1000 bands)</Label>
                </div>
              </div>
              <div>
                <Label>Upload Your Design (Optional)</Label>
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">Max 5MB. Logo will be centered and cropped within diecut lines. Select logo and click 'Duplicate Logo' to add more.</p>
              </div>
              <div>
                <Label>Add Custom Text</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Enter your text"
                    onKeyDown={(e) => e.key === "Enter" && handleAddText()}
                  />
                  <Button onClick={handleAddText} variant="outline">
                    Add Text
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Click text on canvas to edit, drag to position. Select object and press Delete to remove.</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-lg mb-3">Order Summary</h3>
                {loadingPrice ? <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div> : pricing ? (
                  <>
                    <div className="flex justify-between text-sm"><span>Base Price (with/without print):</span><span>{currencySymbol}39.00 / 1000 pcs</span></div>
                    {pricing.extraCharges.trademark && <div className="flex justify-between text-sm"><span>Trademark Text:</span><span>+{currencySymbol}15.00 / 1000 pcs</span></div>}
                    {pricing.extraCharges.qrCode && <div className="flex justify-between text-sm"><span>QR Code:</span><span>+{currencySymbol}15.00 / 1000 pcs</span></div>}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-medium"><span>Unit Price:</span><span>{currencySymbol}{pricing.unitPrice.toFixed(3)}</span></div>
                      <div className="flex justify-between text-sm"><span>Quantity:</span><span>{quantity} pcs</span></div>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary"><span>Total:</span><span>{currencySymbol}{pricing.totalPrice.toFixed(2)}</span></div>
                  </>
                ) : <p className="text-sm text-muted-foreground text-center py-4">Enter quantity to see pricing</p>}
              </div>
              <Button onClick={handlePlaceOrder} disabled={saving || !pricing} variant="hero" className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {pricing ? `Continue to Summary ${currencySymbol}${pricing.totalPrice.toFixed(2)}` : "Continue"}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DesignStudio;
