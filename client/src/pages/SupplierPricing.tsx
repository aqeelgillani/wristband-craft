import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface PricingConfig {
  id?: string;
  wristbandType: string;
  minQuantity: number;
  basePriceUsd: number;
  basePriceEur: number;
  basePriceGbp: number;
  blackPrintExtraUsd: number;
  blackPrintExtraEur: number;
  blackPrintExtraGbp: number;
  fullColorPrintExtraUsd: number;
  fullColorPrintExtraEur: number;
  fullColorPrintExtraGbp: number;
  secureGuestsExtraUsd: number;
  secureGuestsExtraEur: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  wristbandType: "tyvek",
  minQuantity: 100,
  basePriceUsd: 0.50,
  basePriceEur: 0.45,
  basePriceGbp: 0.40,
  blackPrintExtraUsd: 0.05,
  blackPrintExtraEur: 0.04,
  blackPrintExtraGbp: 0.04,
  fullColorPrintExtraUsd: 0.15,
  fullColorPrintExtraEur: 0.14,
  fullColorPrintExtraGbp: 0.12,
  secureGuestsExtraUsd: 0.10,
  secureGuestsExtraEur: 0.09,
};

const SupplierPricing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<PricingConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/suppliers/me/pricing");
      if (data && data.length > 0) {
        setConfigs(data);
        setActiveConfig(data[0]);
      } else {
        setConfigs([DEFAULT_CONFIG]);
        setActiveConfig(DEFAULT_CONFIG);
      }
    } catch (error) {
      toast.error("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PricingConfig, value: string | number) => {
    const parsedValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    setActiveConfig((prev) => ({
      ...prev,
      [field]: field === 'wristbandType' ? value : parsedValue,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiFetch("/suppliers/me/pricing", {
        method: "POST",
        body: JSON.stringify(activeConfig),
      });
      toast.success("Pricing configuration saved successfully");
      fetchPricing();
    } catch (error: any) {
      toast.error(error.message || "Failed to save pricing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading pricing data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <header className="max-w-4xl mx-auto border-b bg-card/50 backdrop-blur-sm p-4 flex items-center gap-4 rounded-t-xl mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Manage Pricing
        </h1>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Pricing Configuration</CardTitle>
            <CardDescription>
              Set the base and additional charges for your products.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Input value={activeConfig.wristbandType} onChange={(e) => handleInputChange('wristbandType', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min Qty</Label>
                <Input type="number" value={activeConfig.minQuantity} onChange={(e) => handleInputChange('minQuantity', e.target.value)} />
              </div>
            </div>

            <h3 className="font-semibold text-lg border-b pb-2 pt-4">Base Prices</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>USD ($)</Label>
                <Input type="number" step="0.01" value={activeConfig.basePriceUsd} onChange={(e) => handleInputChange('basePriceUsd', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EUR (€)</Label>
                <Input type="number" step="0.01" value={activeConfig.basePriceEur} onChange={(e) => handleInputChange('basePriceEur', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>GBP (£)</Label>
                <Input type="number" step="0.01" value={activeConfig.basePriceGbp} onChange={(e) => handleInputChange('basePriceGbp', e.target.value)} />
              </div>
            </div>

            <h3 className="font-semibold text-lg border-b pb-2 pt-4">Black Print Extra</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>USD</Label>
                <Input type="number" step="0.01" value={activeConfig.blackPrintExtraUsd} onChange={(e) => handleInputChange('blackPrintExtraUsd', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EUR</Label>
                <Input type="number" step="0.01" value={activeConfig.blackPrintExtraEur} onChange={(e) => handleInputChange('blackPrintExtraEur', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>GBP</Label>
                <Input type="number" step="0.01" value={activeConfig.blackPrintExtraGbp} onChange={(e) => handleInputChange('blackPrintExtraGbp', e.target.value)} />
              </div>
            </div>

            <h3 className="font-semibold text-lg border-b pb-2 pt-4">Full Color Print Extra</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>USD</Label>
                <Input type="number" step="0.01" value={activeConfig.fullColorPrintExtraUsd} onChange={(e) => handleInputChange('fullColorPrintExtraUsd', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EUR</Label>
                <Input type="number" step="0.01" value={activeConfig.fullColorPrintExtraEur} onChange={(e) => handleInputChange('fullColorPrintExtraEur', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>GBP</Label>
                <Input type="number" step="0.01" value={activeConfig.fullColorPrintExtraGbp} onChange={(e) => handleInputChange('fullColorPrintExtraGbp', e.target.value)} />
              </div>
            </div>

            <h3 className="font-semibold text-lg border-b pb-2 pt-4">Secure Guests Extra</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>USD</Label>
                <Input type="number" step="0.01" value={activeConfig.secureGuestsExtraUsd} onChange={(e) => handleInputChange('secureGuestsExtraUsd', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EUR</Label>
                <Input type="number" step="0.01" value={activeConfig.secureGuestsExtraEur} onChange={(e) => handleInputChange('secureGuestsExtraEur', e.target.value)} />
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="px-8 flex gap-2">
                <Save size={18} />
                {saving ? "Saving..." : "Save Pricing"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SupplierPricing;
