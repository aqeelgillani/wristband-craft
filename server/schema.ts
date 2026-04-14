generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // use "sqlite" for local if needed
  url      = env("DATABASE_URL")
}

model Profile {
  id         String   @id @default(uuid())
  email      String
  fullName   String?  @map("full_name")
  createdAt  DateTime @default(now()) @map("created_at")

  orders     Order[]
  supplier   Supplier?
  roles      UserRole[]

  @@map("profiles")
}

model Order {
  id                     String   @id @default(uuid())
  userId                 String   @map("user_id")
  designId               String?  @map("design_id")
  supplierId             String?  @map("supplier_id")

  quantity               Int
  totalPrice             Float    @map("total_price")
  unitPrice              Float?   @map("unit_price")
  basePrice              Float?   @map("base_price")

  status                 String
  paymentStatus          String?  @map("payment_status")
  currency               String

  printType              String?  @map("print_type")
  hasSecureGuest         Boolean? @map("has_secure_guest")

  shippingAddress        Json?    @map("shipping_address")
  extraCharges           Json?    @map("extra_charges")
  adminNotes             String?  @map("admin_notes")

  stripePaymentIntentId  String?  @map("stripe_payment_intent_id")
  stripeSessionId        String?  @map("stripe_session_id")

  createdAt              DateTime @default(now()) @map("created_at")

  user       Profile  @relation(fields: [userId], references: [id])
  supplier   Supplier? @relation(fields: [supplierId], references: [id])

  @@map("orders")
}

model Supplier {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")

  companyName   String   @map("company_name")
  contactEmail  String   @map("contact_email")
  contactPhone  String?  @map("contact_phone")
  address       String?  @map("address")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  user    Profile @relation(fields: [userId], references: [id])
  orders  Order[]

  @@map("suppliers")
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  role      AppRole
  createdAt DateTime @default(now()) @map("created_at")

  user Profile @relation(fields: [userId], references: [id])

  @@map("user_roles")
}

model PricingConfig {
  id                         String  @id @default(uuid())

  minQuantity                Int     @map("min_quantity")

  basePriceUsd               Float   @map("base_price_usd")
  basePriceEur               Float   @map("base_price_eur")
  basePriceGbp               Float   @map("base_price_gbp")

  blackPrintExtraUsd         Float   @map("black_print_extra_usd")
  blackPrintExtraEur         Float   @map("black_print_extra_eur")
  blackPrintExtraGbp         Float   @map("black_print_extra_gbp")

  fullColorPrintExtraUsd     Float   @map("full_color_print_extra_usd")
  fullColorPrintExtraEur     Float   @map("full_color_print_extra_eur")
  fullColorPrintExtraGbp     Float   @map("full_color_print_extra_gbp")

  secureGuestsExtraUsd       Float   @map("secure_guests_extra_usd")
  secureGuestsExtraEur       Float   @map("secure_guests_extra_eur")

  @@map("pricing_config")
}

enum AppRole {
  admin
  user
  supplier
}