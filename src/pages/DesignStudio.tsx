import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, Save, ShoppingCart } from "lucide-react";

const DesignStudio = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [wristbandColor, setWristbandColor] = useState("#000000");
  const [customText, setCustomText] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    drawCanvas();
  }, [uploadedImage, wristbandColor, customText, textColor]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        toast.success("Image uploaded successfully");
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw wristband shape
    ctx.fillStyle = wristbandColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(50, canvas.height / 2, 40, 0, Math.PI * 2);
    ctx.arc(canvas.width - 50, canvas.height / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    // Draw uploaded design
    if (uploadedImage) {
      const img = new Image();
      img.onload = () => {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(img, 100, 30, canvas.width - 200, canvas.height - 60);
        ctx.globalAlpha = 1;
        
        // Draw text
        if (customText) {
          ctx.fillStyle = textColor;
          ctx.font = "bold 24px Arial";
          ctx.textAlign = "center";
          ctx.fillText(customText, canvas.width / 2, canvas.height / 2);
        }
      };
      img.src = uploadedImage;
    } else if (customText) {
      // Draw text only
      ctx.fillStyle = textColor;
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(customText, canvas.width / 2, canvas.height / 2);
    }
  };

  const handleSaveDesign = async () => {
    if (!uploadedImage && !customText) {
      toast.error("Please upload a design or add text");
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

      // Convert canvas to blob
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Failed to create design");
          return;
        }

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
        const { error: dbError } = await supabase.from("designs").insert({
          user_id: session.user.id,
          design_url: publicUrl,
          wristband_color: wristbandColor,
          custom_text: customText,
          text_color: textColor,
        });

        if (dbError) {
          toast.error("Failed to save design");
          return;
        }

        toast.success("Design saved successfully!");
        navigate("/my-designs");
      });
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!uploadedImage && !customText) {
      toast.error("Please create a design first");
      return;
    }

    await handleSaveDesign();
    // Navigate to checkout would happen here
    toast.success("Proceeding to checkout...");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Design Studio
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Preview */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Wristband Preview</h2>
            <div className="bg-muted rounded-lg p-8 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={600}
                height={150}
                className="max-w-full rounded-lg shadow-xl"
              />
            </div>
          </Card>

          {/* Controls */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Design Controls</h2>
            <div className="space-y-6">
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
                <Input
                  id="custom-text"
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Enter your text"
                  maxLength={30}
                  className="mt-2"
                />
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

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveDesign} disabled={saving} variant="secondary" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Design
                </Button>
                <Button onClick={handlePlaceOrder} disabled={saving} variant="hero" className="flex-1">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Place Order
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
