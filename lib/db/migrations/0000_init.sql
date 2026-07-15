CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant', 'data');--> statement-breakpoint
CREATE TABLE "budget_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"budget_type" text NOT NULL,
	"threshold_percent" integer,
	"amount_spent" numeric(12, 8),
	"budget_limit" numeric(10, 2),
	"message" text,
	"acknowledged" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "budget_alerts_alert_type_check" CHECK ("budget_alerts"."alert_type" in ('warning', 'limit_reached', 'budget_exceeded')),
	CONSTRAINT "budget_alerts_budget_type_check" CHECK ("budget_alerts"."budget_type" in ('monthly', 'daily', 'per_chat'))
);
--> statement-breakpoint
CREATE TABLE "budget_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text,
	"monthly_budget_usd" numeric(10, 2),
	"daily_budget_usd" numeric(10, 2),
	"per_chat_budget_usd" numeric(10, 2),
	"current_month_spend" numeric(12, 8) DEFAULT '0',
	"current_day_spend" numeric(12, 8) DEFAULT '0',
	"month_reset" timestamp with time zone DEFAULT now(),
	"day_reset" timestamp with time zone DEFAULT now(),
	"warning_threshold_percent" integer DEFAULT 80,
	"email_notifications" boolean DEFAULT true,
	"enforce_limits" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "budget_limits_warning_threshold_percent_check" CHECK ("budget_limits"."warning_threshold_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "chat_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"file_name" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"model" text,
	"title" text,
	"public" boolean DEFAULT false,
	"pinned" boolean DEFAULT false,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"model_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"base_url" text,
	"context_window" integer,
	"input_cost" numeric(10, 6),
	"output_cost" numeric(10, 6),
	"vision" boolean DEFAULT false,
	"tools" boolean DEFAULT false,
	"reasoning" boolean DEFAULT false,
	"audio" boolean DEFAULT false,
	"video" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true,
	"transport_type" text NOT NULL,
	"url" text,
	"headers" jsonb,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "mcp_servers_transport_type_check" CHECK ("mcp_servers"."transport_type" in ('http', 'sse'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"user_id" text,
	"role" "message_role" NOT NULL,
	"content" text,
	"parts" jsonb,
	"model" text,
	"message_group_id" text,
	"experimental_attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "model_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" uuid,
	"message_id" bigint,
	"model_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"input_cost_per_million" numeric(10, 6),
	"output_cost_per_million" numeric(10, 6),
	"input_cost_usd" numeric(12, 8),
	"output_cost_usd" numeric(12, 8),
	"total_cost_usd" numeric(12, 8),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_keys" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"iv" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_keys_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"layout" text,
	"prompt_suggestions" boolean,
	"show_tool_invocations" boolean,
	"show_conversation_previews" boolean,
	"multi_model_enabled" boolean,
	"hidden_models" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"anonymous" boolean DEFAULT false,
	"premium" boolean DEFAULT false,
	"display_name" text,
	"profile_image" text,
	"favorite_models" text[] DEFAULT '{}'::text[],
	"message_count" integer DEFAULT 0,
	"daily_message_count" integer DEFAULT 0,
	"daily_reset" timestamp with time zone,
	"daily_pro_message_count" integer DEFAULT 0,
	"daily_pro_reset" timestamp with time zone,
	"system_prompt" text,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_models" ADD CONSTRAINT "custom_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_usage" ADD CONSTRAINT "model_usage_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_budget_alerts_user_id" ON "budget_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_budget_alerts_created_at" ON "budget_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_budget_alerts_acknowledged" ON "budget_alerts" USING btree ("acknowledged") WHERE "budget_alerts"."acknowledged" = false;--> statement-breakpoint
CREATE INDEX "idx_budget_limits_user_id" ON "budget_limits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_budget_limits_provider" ON "budget_limits" USING btree ("provider_id") WHERE "budget_limits"."provider_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_limits_user_provider_key" ON "budget_limits" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_chat_attachments_chat_id" ON "chat_attachments" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_chat_attachments_user_id" ON "chat_attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chats_user_id" ON "chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chats_project_id" ON "chats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_chats_created_at" ON "chats" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_custom_models_user_id" ON "custom_models" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_models_user_model" ON "custom_models" USING btree ("user_id","provider_id","model_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_user_id" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_user_id" ON "mcp_servers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_enabled" ON "mcp_servers" USING btree ("enabled") WHERE "mcp_servers"."enabled" = true;--> statement-breakpoint
CREATE INDEX "idx_messages_chat_id" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_messages_user_id" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_model_usage_user_id" ON "model_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_model_usage_chat_id" ON "model_usage" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_model_usage_created_at" ON "model_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_model_usage_model_provider" ON "model_usage" USING btree ("model_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_keys_user_id" ON "user_keys" USING btree ("user_id");