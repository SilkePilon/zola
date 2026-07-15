import "server-only"
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3"

if (!process.env.MINIO_ENDPOINT) {
  throw new Error("MINIO_ENDPOINT environment variable is required")
}
if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
  throw new Error(
    "MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required"
  )
}
if (!process.env.MINIO_PUBLIC_URL) {
  throw new Error("MINIO_PUBLIC_URL environment variable is required")
}

const useSSL = process.env.MINIO_USE_SSL === "true"
const port = process.env.MINIO_PORT || "9000"

export const s3Client = new S3Client({
  endpoint: `${useSSL ? "https" : "http"}://${process.env.MINIO_ENDPOINT}:${port}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
})

export const STORAGE_BUCKET = process.env.MINIO_BUCKET || "chat-attachments"
export const STORAGE_PUBLIC_URL = process.env.MINIO_PUBLIC_URL

let bucketReady: Promise<void> | null = null

/**
 * Creates the storage bucket and a public-read policy on first use.
 * supabase/schema.sql did this via SQL migration; MinIO has no
 * equivalent migration file, so it's bootstrapped lazily instead.
 */
export function ensureBucketExists(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: STORAGE_BUCKET }))
      } catch {
        await s3Client.send(
          new CreateBucketCommand({ Bucket: STORAGE_BUCKET })
        )
        await s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: STORAGE_BUCKET,
            Policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: "*",
                  Action: ["s3:GetObject"],
                  Resource: [`arn:aws:s3:::${STORAGE_BUCKET}/*`],
                },
              ],
            }),
          })
        )
      }
    })()
  }
  return bucketReady
}
