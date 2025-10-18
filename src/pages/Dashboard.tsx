import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Palette, FileImage, Package, LogOut } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
      return;
    }
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            WristCraft
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Welcome to Your Dashboard</h2>
          <p className="text-xl text-muted-foreground">
            Start creating your custom wristbands today
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover:shadow-xl transition-shadow cursor-pointer animate-scale-in" onClick={() => navigate("/design-studio")}>
            <CardHeader>
              <Palette className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Design Studio</CardTitle>
              <CardDescription>Create and customize your wristband design</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="hero" className="w-full">
                Start Designing
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow cursor-pointer animate-scale-in" style={{ animationDelay: "0.1s" }} onClick={() => navigate("/my-designs")}>
            <CardHeader>
              <FileImage className="h-12 w-12 text-accent mb-2" />
              <CardTitle>My Designs</CardTitle>
              <CardDescription>View and manage your saved designs</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="accent" className="w-full">
                View Designs
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow cursor-pointer animate-scale-in" style={{ animationDelay: "0.2s" }} onClick={() => navigate("/my-orders")}>
            <CardHeader>
              <Package className="h-12 w-12 text-secondary-foreground mb-2" />
              <CardTitle>My Orders</CardTitle>
              <CardDescription>Track your wristband orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full">
                View Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
