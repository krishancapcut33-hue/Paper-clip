CREATE TABLE "execution_workspace_restore_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"execution_workspace_id" uuid NOT NULL,
	"source_issue_id" uuid,
	"generation" integer NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"activated_at" timestamp with time zone,
	"tree_closed_at" timestamp with time zone,
	"delete_after" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "execution_workspace_restore_points_object_key_uniq" ON "execution_workspace_restore_points" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_workspace_restore_points_live_generation_uniq" ON "execution_workspace_restore_points" USING btree ("execution_workspace_id","generation") WHERE "execution_workspace_restore_points"."status" <> 'deleted';--> statement-breakpoint
CREATE INDEX "execution_workspace_restore_points_status_delete_after_idx" ON "execution_workspace_restore_points" USING btree ("status","delete_after");--> statement-breakpoint
CREATE INDEX "execution_workspace_restore_points_company_idx" ON "execution_workspace_restore_points" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "execution_workspace_restore_points_source_issue_idx" ON "execution_workspace_restore_points" USING btree ("company_id","source_issue_id");