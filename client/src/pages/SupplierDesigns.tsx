import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ImageIcon } from "lucide-react";

type DesignRow = {
  id: string;
  designUrl: string;
  wristbandType: string;
  wristbandColor?: string | null;
  customText?: string | null;
  createdAt: string;
  visibility?: "full" | "fulfillment" | "platform";
  user?: { email: string; fullName?: string | null };
  orders?: { id: string; supplierId?: string | null; status: string; createdAt: string }[];
};

const SupplierDesigns = () => {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<DesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user?.roles?.includes("supplier") && !user?.roles?.includes("admin")) {
          navigate("/");
          return;
        }
        setIsAdmin(user.roles.includes("admin"));
        const data = await apiFetch("/designs/platform");
        setDesigns(data || []);
      } catch {
        toast.error("Could not load designs");
        navigate("/admin");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex-1">
            {isAdmin ? "All designs" : "All designs (platform)"}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          {isAdmin
            ? "Full customer details are visible. Suppliers see anonymized customers unless they already fulfill an order for that design."
            : "You can view every saved design. Customer contact details stay hidden until you are the fulfilling supplier for an order using that design. Unit prices are set in Manage pricing."}
        </p>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : designs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <ImageIcon className="h-12 w-12 opacity-50" />
            <p>No designs yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {designs.map((d) => (
              <Card key={d.id} className="overflow-hidden">
                <div className="aspect-[2/1] bg-muted">
                  {d.designUrl ? (
                    <img src={d.designUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-mono">#{d.id.slice(0, 8)}</CardTitle>
                    {d.visibility && (
                      <Badge variant="outline" className="shrink-0">
                        {d.visibility}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.user?.email}
                    {d.user?.fullName ? ` · ${d.user.fullName}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Type:</span> {d.wristbandType}
                  </p>
                  {d.customText && (
                    <p>
                      <span className="text-muted-foreground">Text:</span> {d.customText}
                    </p>
                  )}
                  {d.orders && d.orders.length > 0 && (
                    <p className="text-xs text-muted-foreground pt-2">Linked orders: {d.orders.length}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SupplierDesigns;
