CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."debt_direction" AS ENUM('lent', 'borrowed');--> statement-breakpoint
CREATE TYPE "public"."tx_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."tx_source" AS ENUM('manual', 'tutoring', 'debt');--> statement-breakpoint
CREATE TYPE "public"."wallet_kind" AS ENUM('cash', 'bank', 'ewallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."photo_kind" AS ENUM('check_in', 'check_out');--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[a-z0-9._-]{3,32}$')
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"bank_bin" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"tuition_auto_income" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "category_kind" NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"system_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_user_id_id_key" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"debt_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"wallet_id" uuid,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debt_payments_amount_positive" CHECK ("debt_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "debt_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"direction" "debt_direction" NOT NULL,
	"counterparty" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"principal" bigint NOT NULL,
	"occurred_on" date NOT NULL,
	"due_on" date,
	"note" text DEFAULT '' NOT NULL,
	"wallet_id" uuid,
	"transaction_id" uuid,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debts_user_id_id_key" UNIQUE("user_id","id"),
	CONSTRAINT "debts_principal_positive" CHECK ("debts"."principal" > 0)
);
--> statement-breakpoint
ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid,
	"category_id" uuid,
	"occurred_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source" "tx_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_user_id_id_key" UNIQUE("user_id","id"),
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_shape" CHECK (("transactions"."kind" = 'transfer' and "transactions"."to_wallet_id" is not null and "transactions"."to_wallet_id" <> "transactions"."wallet_id" and "transactions"."category_id" is null)
        or ("transactions"."kind" <> 'transfer' and "transactions"."to_wallet_id" is null and ("transactions"."category_id" is not null or "transactions"."source" = 'debt')))
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "wallet_kind" DEFAULT 'cash' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_id_key" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "photo_kind" NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "lesson_status" DEFAULT 'in_progress' NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_out_at" timestamp with time zone,
	"device_check_in_at" timestamp with time zone,
	"device_check_out_at" timestamp with time zone,
	"fee" bigint DEFAULT 0 NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"lesson_note" text DEFAULT '' NOT NULL,
	"private_note" text DEFAULT '' NOT NULL,
	"check_in_lat" double precision,
	"check_in_lng" double precision,
	"check_out_lat" double precision,
	"check_out_lng" double precision,
	"client_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_user_id_id_key" UNIQUE("user_id","id"),
	CONSTRAINT "lessons_user_id_id_student_key" UNIQUE("user_id","id","student_id"),
	CONSTRAINT "lessons_fee_non_negative" CHECK ("lessons"."fee" >= 0),
	CONSTRAINT "lessons_checkout_after_checkin" CHECK ("lessons"."check_out_at" is null or "lessons"."check_out_at" >= "lessons"."check_in_at"),
	CONSTRAINT "lessons_completed_has_checkout" CHECK ("lessons"."status" <> 'completed' or "lessons"."check_out_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_cipher" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "share_links_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"parent_name" text DEFAULT '' NOT NULL,
	"parent_phone" text DEFAULT '' NOT NULL,
	"rate_per_session" bigint DEFAULT 0 NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_user_id_id_key" UNIQUE("user_id","id"),
	CONSTRAINT "students_rate_non_negative" CHECK ("students"."rate_per_session" >= 0)
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tuition_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" DEFAULT 'transfer' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"wallet_id" uuid,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tuition_payments_amount_positive" CHECK ("tuition_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "tuition_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_fk" FOREIGN KEY ("user_id","debt_id") REFERENCES "public"."debts"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_wallet_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_wallet_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_wallet_fk" FOREIGN KEY ("user_id","to_wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."categories"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_photos" ADD CONSTRAINT "lesson_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_photos" ADD CONSTRAINT "lesson_photos_lesson_fk" FOREIGN KEY ("user_id","lesson_id","student_id") REFERENCES "public"."lessons"("user_id","id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_student_fk" FOREIGN KEY ("user_id","student_id") REFERENCES "public"."students"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_student_fk" FOREIGN KEY ("user_id","student_id") REFERENCES "public"."students"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_student_fk" FOREIGN KEY ("user_id","student_id") REFERENCES "public"."students"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_wallet_fk" FOREIGN KEY ("user_id","wallet_id") REFERENCES "public"."wallets"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_transaction_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."transactions"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_kind_name_key" ON "categories" USING btree ("user_id","kind","name") WHERE "categories"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_system_key" ON "categories" USING btree ("user_id","system_key") WHERE "categories"."system_key" is not null;--> statement-breakpoint
CREATE INDEX "debt_payments_debt_idx" ON "debt_payments" USING btree ("user_id","debt_id");--> statement-breakpoint
CREATE INDEX "debts_user_direction_idx" ON "debts" USING btree ("user_id","direction");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_user_wallet_idx" ON "transactions" USING btree ("user_id","wallet_id");--> statement-breakpoint
CREATE INDEX "transactions_user_to_wallet_idx" ON "transactions" USING btree ("user_id","to_wallet_id");--> statement-breakpoint
CREATE INDEX "transactions_user_category_idx" ON "transactions" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_name_key" ON "wallets" USING btree ("user_id","name") WHERE "wallets"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_photos_lesson_kind_key" ON "lesson_photos" USING btree ("lesson_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_one_active_per_user" ON "lessons" USING btree ("user_id") WHERE "lessons"."status" = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_client_request_key" ON "lessons" USING btree ("user_id","client_request_id") WHERE "lessons"."client_request_id" is not null;--> statement-breakpoint
CREATE INDEX "lessons_user_checkin_idx" ON "lessons" USING btree ("user_id","check_in_at");--> statement-breakpoint
CREATE INDEX "lessons_user_student_checkin_idx" ON "lessons" USING btree ("user_id","student_id","check_in_at");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_one_active_per_student" ON "share_links" USING btree ("user_id","student_id") WHERE "share_links"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "students_user_idx" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tuition_payments_user_student_idx" ON "tuition_payments" USING btree ("user_id","student_id","paid_on");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_settings" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "categories" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "debt_payments" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "debts" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "transactions" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "wallets" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lesson_photos" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "parent_student_scope" ON "lesson_photos" AS RESTRICTIVE FOR ALL TO public USING (nullif(current_setting('app.student_id', true), '')::uuid is null or student_id = nullif(current_setting('app.student_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "lessons" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "parent_student_scope" ON "lessons" AS RESTRICTIVE FOR ALL TO public USING (nullif(current_setting('app.student_id', true), '')::uuid is null or student_id = nullif(current_setting('app.student_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "share_link_access" ON "share_links" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid or token_hash = nullif(current_setting('app.share_token_hash', true), '')) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "students" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "parent_student_scope" ON "students" AS RESTRICTIVE FOR ALL TO public USING (nullif(current_setting('app.student_id', true), '')::uuid is null or id = nullif(current_setting('app.student_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tuition_payments" AS PERMISSIVE FOR ALL TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "parent_student_scope" ON "tuition_payments" AS RESTRICTIVE FOR ALL TO public USING (nullif(current_setting('app.student_id', true), '')::uuid is null or student_id = nullif(current_setting('app.student_id', true), '')::uuid);