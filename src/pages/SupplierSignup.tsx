import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, ArrowLeft } from "lucide-react";

const SupplierSignup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName || !formData.contactEmail || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.contactEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          data: {
            full_name: formData.companyName,
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) throw new Error("User creation failed");

      // Create supplier record
      const { error: supplierError } = await supabase.from("suppliers").insert({
        user_id: authData.user.id,
        company_name: formData.companyName,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone,
        address: formData.address,
      });

      if (supplierError) throw supplierError;

      // Add supplier role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "supplier",
      });

      if (roleError) throw roleError;

      toast.success("Supplier account created successfully! Please check your email to verify.");
      navigate("/supplier-login");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message || "Failed to create supplier account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Supplier Registration
          </CardTitle>
          <CardDescription>
            Create your supplier account to receive and manage orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                name="companyName"
                type="text"
                placeholder="Your Company Ltd"
                value={formData.companyName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                placeholder="contact@company.com"
                value={formData.contactEmail}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.contactPhone}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                type="text"
                placeholder="123 Main St, City, Country"
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} variant="hero">
              <Building2 className="h-4 w-4 mr-2" />
              {loading ? "Creating Account..." : "Create Supplier Account"}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate("/supplier-login")}
              className="text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierSignup;
