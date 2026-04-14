import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface ProductionDownloadProps {
  order: any;
}

export const ProductionDownload = ({ order }: ProductionDownloadProps) => {
  const generateProductionPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Production Specification", margin, yPos);
    yPos += 15;

    // Order Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Order ID: ${order.id.substring(0, 8)}`, margin, yPos);
    yPos += 8;
    doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, margin, yPos);
    yPos += 8;
    doc.text(`Customer: ${order.profiles?.full_name || order.profiles?.email || "N/A"}`, margin, yPos);
    yPos += 15;

    // Wristband Specifications
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Wristband Specifications", margin, yPos);
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Type and Quantity
    doc.text(`Type: ${order.designs?.wristband_type || "N/A"}`, margin, yPos);
    yPos += 8;
    doc.text(`Quantity: ${order.quantity} pieces`, margin, yPos);
    yPos += 8;
    
    // Color
    const wristbandColor = order.designs?.wristband_color || "#FFFFFF";
    doc.text(`Wristband Color: ${wristbandColor}`, margin, yPos);
    yPos += 8;

    // Print Type
    if (order.print_type && order.print_type !== "none") {
      doc.text(`Print Type: ${order.print_type === "black" ? "Black Print" : "Full Color Print"}`, margin, yPos);
      yPos += 8;
    }

    // Text Details
    if (order.designs?.custom_text) {
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Text Details:", margin, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.text(`Custom Text: ${order.designs.custom_text}`, margin, yPos);
      yPos += 8;
      doc.text(`Text Color: ${order.designs?.text_color || "#000000"}`, margin, yPos);
      yPos += 8;
      if (order.designs?.text_position) {
        doc.text(`Text Position: X=${order.designs.text_position.x}px, Y=${order.designs.text_position.y}px`, margin, yPos);
        yPos += 8;
      }
    }

    // QR/Secure Features
    if (order.has_secure_guests) {
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Security Features:", margin, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.text("✓ QR Code / Secure Guests Enabled", margin, yPos);
      yPos += 8;
    }

    // Measurements Section
    yPos += 10;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Standard Measurements", margin, yPos);
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const wristbandType = order.designs?.wristband_type || "tyvek";
    let measurements = "";
    
    switch(wristbandType.toLowerCase()) {
      case "tyvek":
        measurements = "Width: 19mm (3/4\") × Length: 254mm (10\")\nPrint Area: 228mm × 15mm\nAdhesive Strip: 25mm";
        break;
      case "vinyl":
        measurements = "Width: 19mm (3/4\") × Length: 254mm (10\")\nPrint Area: 228mm × 15mm\nSnap Closure: Plastic";
        break;
      case "silicone":
        measurements = "Width: 12mm (1/2\") × Circumference: 202mm (8\")\nPrint Area: Full surface\nDebossed/Embossed Depth: 0.5mm";
        break;
      case "fabric":
        measurements = "Width: 15mm (5/8\") × Length: 350mm (13.75\")\nWoven Text Height: 10mm\nClosure: Metal/Plastic Clasp";
        break;
      default:
        measurements = "Standard wristband dimensions\nContact production for specific measurements";
    }

    const lines = measurements.split("\n");
    lines.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 7;
    });

    // Design Preview
    if (order.designs?.design_url) {
      yPos += 10;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Design Preview", margin, yPos);
      yPos += 10;
      
      try {
        const img = new Image();
        img.src = order.designs.design_url;
        const imgWidth = pageWidth - (2 * margin);
        const imgHeight = 80;
        doc.addImage(img, "PNG", margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
      } catch (e) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("Design image could not be embedded. View online:", margin, yPos);
        yPos += 8;
        doc.setTextColor(0, 0, 255);
        doc.textWithLink("View Design", margin, yPos, { url: order.designs.design_url });
        doc.setTextColor(0, 0, 0);
      }
    }

    // Shipping Address
    if (order.shipping_address) {
      yPos += 10;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Shipping Address", margin, yPos);
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      const addr = order.shipping_address;
      doc.text(`${addr.name || ""}`, margin, yPos);
      yPos += 7;
      doc.text(`${addr.address}`, margin, yPos);
      yPos += 7;
      doc.text(`${addr.city}, ${addr.state || ""} ${addr.zipCode}`, margin, yPos);
      yPos += 7;
      doc.text(`${addr.country}`, margin, yPos);
      if (addr.phone) {
        yPos += 7;
        doc.text(`Phone: ${addr.phone}`, margin, yPos);
      }
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | EU Wristbands Production`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );

    // Save
    doc.save(`production-order-${order.id.substring(0, 8)}.pdf`);
  };

  const downloadDesignImage = async () => {
    if (!order.designs?.design_url) {
      toast.error("No design image available");
      return;
    }
    
    try {
      const response = await fetch(order.designs.design_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `logo-design-${order.id.substring(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Logo downloaded successfully");
    } catch (error) {
      toast.error("Failed to download logo");
      console.error("Download error:", error);
    }
  };

  const downloadProductionPDF = () => {
    try {
      generateProductionPDF();
      toast.success("Production PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error("PDF generation error:", error);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {order.designs?.design_url && (
        <Button
          variant="outline"
          size="sm"
          onClick={downloadDesignImage}
          className="gap-2"
        >
          <ImageIcon className="h-4 w-4" />
          Logo/Design
        </Button>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={downloadProductionPDF}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Full Production PDF
      </Button>
    </div>
  );
};
