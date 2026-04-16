import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Package } from "lucide-react";

interface Order {
  id: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  status: string;
  createdAt: string;
  design: {
    designUrl: string;
    customText: string | null;
    wristbandColor: string;
    wristbandType: string;
  } | null;
}

const MyOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await apiFetch("/orders/mine");
      setOrders(data || []);
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "processing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
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
            My Orders
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground mb-6">No orders yet</p>
            <Button variant="hero" onClick={() => navigate("/design-studio")}>
              Create Your First Design
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      Order #{order.id.slice(0, 8)}
                    </CardTitle>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {order.design && (
                      <div>
                        <img
                          src={order.design.designUrl}
                          alt="Order design"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold capitalize">{order.design?.wristbandType || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span className="font-semibold">{order.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unit Price:</span>
                        <span className="font-semibold">${order.unitPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold text-primary">${order.totalPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-semibold">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {order.design?.customText && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Text:</span>
                          <span className="font-semibold">{order.design.customText}</span>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-4 justify-end border-t mt-4">
                        {order.design?.designUrl && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = order.design!.designUrl;
                              link.download = `order-design-${order.id.slice(0, 8)}.png`;
                              link.target = "_blank";
                              link.click();
                            }}
                          >
                            Download Design
                          </Button>
                        )}
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            // Send them to design studio to edit/start a new order with same config
                            navigate("/design-studio", {
                              state: {
                                editDesign: {
                                  orderDetails: {
                                    wristband_color: order.design?.wristbandColor,
                                    wristband_type: order.design?.wristbandType,
                                    quantity: order.quantity,
                                    print_type: order.printType || "none",
                                    trademark_text: order.design?.customText || "",
                                  }
                                }
                              }
                            });
                          }}
                        >
                          Edit / Reorder
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
