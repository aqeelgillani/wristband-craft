import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Package, DollarSign, Users, TrendingUp } from "lucide-react";

interface Order {
  id: string;
  quantity: number;
  total_price: number;
  unit_price: number;
  status: string;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  print_type?: string;
  extra_charges?: any;
  profiles: {
    email: string;
  } | null;
  designs: {
    design_url: string;
    wristband_type: string;
    wristband_color?: string;
    custom_text: string | null;
  } | null;
  suppliers: {
    company_name: string;
  } | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has admin or supplier role
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roleError || !roles || roles.length === 0) {
        toast.error("Access denied - Admin or Supplier only");
        navigate("/");
        return;
      }

      const hasAdminRole = roles.some(r => r.role === "admin");
      const hasSupplierRole = roles.some(r => r.role === "supplier");

      if (hasAdminRole) {
        setIsAdmin(true);
        fetchOrders();
      } else if (hasSupplierRole) {
        setIsSupplier(true);
        // Get supplier ID
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("id")
          .eq("user_id", session.user.id)
          .single();
        
        if (supplier) {
          setSupplierId(supplier.id);
          fetchOrders(supplier.id);
        }
      } else {
        toast.error("Access denied - Admin or Supplier only");
        navigate("/");
      }
    } catch (error) {
      navigate("/");
    }
  };

  const fetchOrders = async (filterSupplierId?: string) => {
    try {
      let query = supabase
        .from("orders")
        .select(`
          *,
          profiles (email),
          designs (
            design_url,
            wristband_type,
            custom_text
          ),
          suppliers (company_name)
        `)
        .order("created_at", { ascending: false });

      // Filter by supplier if not admin
      if (filterSupplierId) {
        query = query.eq("supplier_id", filterSupplierId);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Failed to load orders");
        return;
      }

      setOrders(data || []);
      
      // Calculate stats
      const totalRevenue = data?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;
      const pendingOrders = data?.filter(order => order.status === "pending").length || 0;
      const paidOrders = data?.filter(order => order.payment_status === "paid").length || 0;
      
      setStats({
        totalOrders: data?.length || 0,
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
      const { error } = await supabase.functions.invoke("update-order-status", {
        body: { orderId, status: newStatus },
      });

      if (error) throw error;

      // Send email notification if order is approved
      if (newStatus === "approved") {
        const { error: emailError } = await supabase.functions.invoke("send-order-confirmation", {
          body: { orderId },
        });
        if (emailError) {
          console.error("Failed to send confirmation email:", emailError);
          toast.warning("Order approved but email notification failed");
        } else {
          toast.success("Order approved and confirmation email sent");
        }
      } else {
        toast.success(`Order status updated to ${newStatus}`);
      }

      fetchOrders(supplierId || undefined);
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {isAdmin ? "Admin Dashboard" : "Supplier Dashboard"}
          </h1>
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
            <h2 className="text-2xl font-bold mb-4">All Orders</h2>
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        Order #{order.id.slice(0, 8)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {order.profiles?.email || "Guest"}
                      </p>
                      {order.suppliers && (
                        <p className="text-xs text-muted-foreground">
                          Supplier: {order.suppliers.company_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPaymentStatusColor(order.payment_status)}>
                        {order.payment_status}
                      </Badge>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusUpdate(order.id, value)}
                        disabled={!isAdmin}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approve</SelectItem>
                          <SelectItem value="declined">Decline</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {order.designs && (
                      <div>
                        <img
                          src={order.designs.design_url}
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
                            {order.designs?.wristband_type || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Quantity</span>
                          <div className="font-semibold">{order.quantity} pcs</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Color</span>
                          <div className="font-semibold flex items-center gap-2">
                            {order.designs?.wristband_color && (
                              <span 
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: order.designs.wristband_color }}
                              />
                            )}
                            {order.designs?.wristband_color || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Print Type</span>
                          <div className="font-semibold capitalize">
                            {(order as any).print_type || "none"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Unit Price</span>
                          <div className="font-semibold">${order.unit_price}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Total</span>
                          <div className="font-semibold text-primary">${order.total_price}</div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Date</span>
                          <div className="font-semibold">
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {order.designs?.custom_text && (
                          <div>
                            <span className="text-xs text-muted-foreground">Trademark</span>
                            <div className="font-semibold">{order.designs.custom_text}</div>
                          </div>
                        )}
                        {(order as any).extra_charges && (
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground">Extras</span>
                            <div className="font-semibold text-sm">
                              {Object.entries((order as any).extra_charges as Record<string, number>).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="capitalize">{key}:</span>
                                  <span>${value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

export default AdminDashboard;