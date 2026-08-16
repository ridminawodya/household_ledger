import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

const BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET ?? "receipts";

function getClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function uploadReceipt(
  groupId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<string> {
  const client = getClient();
  const ext = file.originalname.split(".").pop() ?? "jpg";
  const path = `${groupId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
