-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "design_id" TEXT,
    "supplier_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "total_price" REAL NOT NULL,
    "unit_price" REAL,
    "base_price" REAL,
    "status" TEXT NOT NULL,
    "payment_status" TEXT,
    "currency" TEXT NOT NULL,
    "print_type" TEXT,
    "has_secure_guest" BOOLEAN,
    "shipping_address" TEXT,
    "extra_charges" TEXT,
    "admin_notes" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_session_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "designs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "design_url" TEXT NOT NULL,
    "custom_text" TEXT,
    "text_color" TEXT,
    "text_position" TEXT,
    "wristband_color" TEXT,
    "wristband_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pricing_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "secure_guests_extra_eur" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_user_id_key" ON "suppliers"("user_id");
