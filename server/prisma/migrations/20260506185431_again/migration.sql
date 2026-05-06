/*
  Warnings:

  - You are about to drop the column `has_secure_guest` on the `orders` table. All the data in the column will be lost.
  - Added the required column `wristband_type` to the `pricing_config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "note" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "design_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "design_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_type" TEXT NOT NULL DEFAULT 'logo',
    "position" TEXT NOT NULL DEFAULT '{"x": 50, "y": 50}',
    "scale" REAL NOT NULL DEFAULT 1.0,
    "rotation" REAL NOT NULL DEFAULT 0,
    "layer_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_images_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "wristband_type" TEXT NOT NULL,
    "price_usd" REAL NOT NULL,
    "price_eur" REAL,
    "price_gbp" REAL,
    "print_extra_usd" REAL NOT NULL DEFAULT 0,
    "color_print_extra_usd" REAL NOT NULL DEFAULT 0,
    "logo_extra_usd" REAL NOT NULL DEFAULT 0,
    "min_order_quantity" INTEGER NOT NULL DEFAULT 1,
    "max_order_quantity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_urls" TEXT NOT NULL DEFAULT '[]',
    "allows_custom_text" BOOLEAN NOT NULL DEFAULT true,
    "allows_custom_color" BOOLEAN NOT NULL DEFAULT true,
    "allows_logo_upload" BOOLEAN NOT NULL DEFAULT true,
    "allows_inner_text" BOOLEAN NOT NULL DEFAULT false,
    "available_sizes" TEXT NOT NULL DEFAULT '["S","M","L","XL"]',
    "available_colors" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_pricing_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "price_per_unit_usd" REAL NOT NULL,
    "price_per_unit_eur" REAL,
    "price_per_unit_gbp" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_pricing_tiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_designs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT,
    "design_name" TEXT,
    "design_url" TEXT NOT NULL,
    "custom_text" TEXT,
    "text_color" TEXT,
    "text_position" TEXT,
    "font_family" TEXT DEFAULT 'Arial',
    "font_size" INTEGER DEFAULT 14,
    "logo_url" TEXT,
    "logo_position" TEXT,
    "logo_scale" REAL DEFAULT 1.0,
    "wristband_color" TEXT,
    "wristband_type" TEXT,
    "wristband_size" TEXT DEFAULT 'M',
    "custom_width_mm" REAL,
    "inner_text" TEXT,
    "inner_text_color" TEXT DEFAULT '#FFFFFF',
    "pattern" TEXT DEFAULT 'solid',
    "secondary_color" TEXT,
    "clip_art_id" TEXT,
    "clip_art_position" TEXT,
    "canvas_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "designs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_designs" ("created_at", "custom_text", "design_url", "id", "text_color", "text_position", "updated_at", "user_id", "wristband_color", "wristband_type") SELECT "created_at", "custom_text", "design_url", "id", "text_color", "text_position", "updated_at", "user_id", "wristband_color", "wristband_type" FROM "designs";
DROP TABLE "designs";
ALTER TABLE "new_designs" RENAME TO "designs";
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "design_id" TEXT,
    "supplier_id" TEXT,
    "product_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "total_price" REAL NOT NULL,
    "unit_price" REAL,
    "base_price" REAL,
    "status" TEXT NOT NULL,
    "payment_status" TEXT,
    "currency" TEXT NOT NULL,
    "print_type" TEXT,
    "has_secure_guests" BOOLEAN,
    "shipping_address" TEXT,
    "extra_charges" TEXT,
    "admin_notes" TEXT,
    "customization_notes" TEXT,
    "wristband_size" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_session_id" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "courier" TEXT,
    "estimated_delivery" DATETIME,
    "shipped_at" DATETIME,
    "delivered_at" DATETIME,
    "pricing_snapshot_json" TEXT,
    "design_snapshot_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("admin_notes", "base_price", "created_at", "currency", "design_id", "extra_charges", "id", "payment_status", "print_type", "quantity", "shipping_address", "status", "stripe_payment_intent_id", "stripe_session_id", "supplier_id", "total_price", "unit_price", "user_id") SELECT "admin_notes", "base_price", "created_at", "currency", "design_id", "extra_charges", "id", "payment_status", "print_type", "quantity", "shipping_address", "status", "stripe_payment_intent_id", "stripe_session_id", "supplier_id", "total_price", "unit_price", "user_id" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE TABLE "new_pricing_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplier_id" TEXT,
    "wristband_type" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "base_price_usd" REAL NOT NULL,
    "base_price_eur" REAL NOT NULL,
    "base_price_gbp" REAL NOT NULL,
    "black_print_extra_usd" REAL NOT NULL,
    "black_print_extra_eur" REAL NOT NULL,
    "black_print_extra_gbp" REAL NOT NULL,
    "full_color_print_extra_usd" REAL NOT NULL,
    "full_color_print_extra_eur" REAL NOT NULL,
    "full_color_print_extra_gbp" REAL NOT NULL,
    "secure_guests_extra_usd" REAL NOT NULL,
    "secure_guests_extra_eur" REAL NOT NULL,
    CONSTRAINT "pricing_config_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pricing_config" ("base_price_eur", "base_price_gbp", "base_price_usd", "black_print_extra_eur", "black_print_extra_gbp", "black_print_extra_usd", "full_color_print_extra_eur", "full_color_print_extra_gbp", "full_color_print_extra_usd", "id", "min_quantity", "secure_guests_extra_eur", "secure_guests_extra_usd") SELECT "base_price_eur", "base_price_gbp", "base_price_usd", "black_print_extra_eur", "black_print_extra_gbp", "black_print_extra_usd", "full_color_print_extra_eur", "full_color_print_extra_gbp", "full_color_print_extra_usd", "id", "min_quantity", "secure_guests_extra_eur", "secure_guests_extra_usd" FROM "pricing_config";
DROP TABLE "pricing_config";
ALTER TABLE "new_pricing_config" RENAME TO "pricing_config";
CREATE TABLE "new_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_profiles" ("created_at", "email", "full_name", "id") SELECT "created_at", "email", "full_name", "id" FROM "profiles";
DROP TABLE "profiles";
ALTER TABLE "new_profiles" RENAME TO "profiles";
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");
CREATE TABLE "new_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "address" TEXT,
    "logo_url" TEXT,
    "description" TEXT,
    "website" TEXT,
    "city" TEXT,
    "country" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_suppliers" ("address", "company_name", "contact_email", "contact_phone", "created_at", "id", "updated_at", "user_id") SELECT "address", "company_name", "contact_email", "contact_phone", "created_at", "id", "updated_at", "user_id" FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";
CREATE UNIQUE INDEX "suppliers_user_id_key" ON "suppliers"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
