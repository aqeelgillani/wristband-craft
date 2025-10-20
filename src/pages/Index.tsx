import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroImage from "@/assets/hero-wristbands.jpg";
import { Palette, Zap, ShieldCheck, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            EU Wristbands
          </h1>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button variant="hero" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto animate-fade-in">
            <h2 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Design Your Perfect Wristband
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Create custom wristbands with your own designs, text, and colors. Professional quality, delivered to your door.
            </p>
            <div className="flex gap-4 justify-center mb-12">
              <Button size="lg" variant="hero" onClick={() => navigate("/auth")}>
                Start Designing <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                View Examples
              </Button>
            </div>
            <img
              src={heroImage}
              alt="Custom wristbands showcase"
              className="rounded-2xl shadow-2xl mx-auto animate-float"
            />
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-20">
          <h3 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose EU Wristbands?
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="hover:shadow-xl transition-shadow animate-scale-in">
              <CardContent className="pt-6 text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Palette className="h-8 w-8 text-primary" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Easy Design Studio</h4>
                <p className="text-muted-foreground">
                  Intuitive tools to upload images, add text, and customize colors in real-time
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow animate-scale-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="pt-6 text-center">
                <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-accent" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Fast Production</h4>
                <p className="text-muted-foreground">
                  Quick turnaround times with professional-grade manufacturing
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow animate-scale-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="pt-6 text-center">
                <div className="bg-secondary/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-secondary-foreground" />
                </div>
                <h4 className="text-xl font-semibold mb-2">Quality Guaranteed</h4>
                <p className="text-muted-foreground">
                  Durable materials and vibrant prints that last
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="bg-gradient-primary rounded-3xl p-12 md:p-16 shadow-2xl">
            <h3 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Ready to Get Started?
            </h3>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers creating custom wristbands
            </p>
            <Button size="lg" variant="secondary" onClick={() => navigate("/auth")}>
              Create Your Account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 EU Wristbands. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
