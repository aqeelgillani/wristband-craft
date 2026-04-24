import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Package, DollarSign, Users, TrendingUp } from "lucide-react";
import { ProductionDownload } from "@/components/ProductionDownload";

interface Order {
  id: string;
  supplierId?: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  printType?: string;
  extraCharges?: Record<string, number>;
  customizationNotes?: string | null;
  canManage?: boolean;
  visibility?: "fulfillment" | "platform" | "full";
  user: { email: string } | null;
  design: {
    designUrl: string;
    wristbandType: string;
    wristbandColor?: string;
    customText: string | null;
  } | null;
  supplier: { companyName: string } | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    paidOrders: 0,
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const hasAdminRole = user.roles?.includes("admin");
      const hasSupplierRole = user.roles?.includes("supplier");

      if (hasAdminRole) {
        setIsAdmin(true);
        await fetchOrders("all");
      } else if (hasSupplierRole) {
        setIsSupplier(true);
        await fetchOrders("own");
      } else {
        toast.error("Access denied - Admin or Supplier only");
        navigate("/");
      }
    } catch (error) {
      navigate("/");
    }
  };

  /** 'all' = admin; 'own' = supplier revenue scope (orders you fulfill) */
  const fetchOrders = async (statsScope: "all" | "own" = "all") => {
    try {
      const data = await apiFetch("/orders");
      const visibleOrders = (data || []) as Order[];
      setOrders(visibleOrders);
      const forStats =
        statsScope === "own" ? visibleOrders.filter((o) => o.canManage) : visibleOrders;
      const totalRevenue = forStats.reduce((sum, order) => sum + Number(order.totalPrice), 0);
      const pendingOrders = forStats.filter((order) => order.status === "pending").length;
      const paidOrders = forStats.filter((order) => order.paymentStatus === "paid").length;
      setStats({
        totalOrders: forStats.length,
        totalRevenue,
        pendingOrders,
        paidOrders,
      });
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Order status updated to ${newStatus}`);

      await fetchOrders(isAdmin ? "all" : "own");
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "approved":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!isAdmin && !isSupplier) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent flex-1">
            {isAdmin ? "Admin Dashboard" : "Supplier Dashboard"}
          </h1>
          {(isAdmin || isSupplier) && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/designs")}>
              All designs
            </Button>
          )}
          {isSupplier && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/pricing")}>
              Manage pricing
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid Orders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paidOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-1">
              {isSupplier ? "All platform orders" : "All orders"}
            </h2>
            {isSupplier && (
              <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
                You can browse every order for context. You only fulfill orders for your company; only those allow status
                changes. Customer and shipping details are hidden on other suppliers&apos; orders. Prices are set under
                Manage pricing.
              </p>
            )}
            {orders.map((order) => (
              <Card
                key={order.id}
                className={
                  order.visibility === "platform" ? "hover:shadow-xl transition-shadow border-dashed" : "hover:shadow-xl transition-shadow"
                }
              >
                <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                        {isSupplier && order.visibility === "platform" && (
                          <Badge variant="secondary">Reference — other supplier</Badge>
                        )}
                        {isSupplier && order.canManage && (
                          <Badge className="bg-primary/20 text-primary-foreground">Your order</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.user?.email || "Guest"}
                      </p>
                      {order.supplier && (
                        <p className="text-xs text-muted-foreground">
                          Supplier: {order.supplier.companyName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                        {order.paymentStatus}
                      </Badge>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusUpdate(order.id, value)}
                        disabled={!(isAdmin || order.canManage === true)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approve</SelectItem>
                          <SelectItem value="declined">Decline</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {order.design && (
                      <div>
                        <img
                          src={order.design.designUrl}
                          alt="Order design"
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="md:col-span-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Type</span>
                          <div className="font-semibold capitalize">
                            {order.design?.wristbandType || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Quantity</span>
                          <div className="font-semibold">{order.quantity} pcs</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Color</span>
                          <div className="font-semibold flex items-center gap-2">
                            {order.design?.wristbandColor && (
                              <span 
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: order.design.wristbandColor }}
                              />
                            )}
                            {order.design?.wristbandColor || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Print Type</span>
                          <div className="font-semibold capitalize">
                            {order.printType || "none"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Unit Price</span>
                          <div className="font-semibold">${order.unitPrice}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Total</span>
                          <div className="font-semibold text-primary">${order.totalPrice}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Date</span>
                          <div className="font-semibold">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {order.design?.customText && (
                          <div>
                            <span className="text-xs text-muted-foreground">Trademark</span>
                            <div className="font-semibold">{order.design.customText}</div>
                          </div>
                        )}
                        {order.customizationNotes && (
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground">Customer notes</span>
                            <div className="font-semibold text-sm whitespace-pre-wrap">{order.customizationNotes}</div>
                          </div>
                        )}
                        {order.extraCharges && (
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground">Extras</span>
                            <div className="font-semibold text-sm">
                              {Object.entries(order.extraCharges).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="capitalize">{key}:</span>
                                  <span>${value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {isAdmin || order.canManage ? (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-semibold text-sm mb-3">Production files</h4>
                          <ProductionDownload order={order} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Production downloads are available for orders your company fulfills.
                        </p>
                      )}
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

export default AdminDashboard;