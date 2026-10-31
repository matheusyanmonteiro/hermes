CREATE TABLE "google_drive_configurations" (
    "id" VARCHAR(40) NOT NULL DEFAULT 'default',
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret_encrypted" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_drive_configurations_pkey" PRIMARY KEY ("id")
);
