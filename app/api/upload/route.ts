import { auth } from "@/lib/auth"
import { DAILY_FILE_UPLOAD_LIMIT } from "@/lib/config"
import { db } from "@/lib/db/client"
import { chatAttachments, chats } from "@/lib/db/schema"
import {
  ensureBucketExists,
  s3Client,
  STORAGE_BUCKET,
  STORAGE_PUBLIC_URL,
} from "@/lib/storage/client"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { and, count, eq, gte } from "drizzle-orm"
import * as fileType from "file-type"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const chatId = formData.get("chatId")

  if (!(file instanceof File) || typeof chatId !== "string") {
    return NextResponse.json(
      { error: "Missing file or chatId" },
      { status: 400 }
    )
  }

  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat || chat.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const [{ value: uploadedToday }] = await db
    .select({ value: count() })
    .from(chatAttachments)
    .where(
      and(
        eq(chatAttachments.userId, session.user.id),
        gte(chatAttachments.createdAt, startOfToday)
      )
    )

  if (uploadedToday >= DAILY_FILE_UPLOAD_LIMIT) {
    return NextResponse.json(
      {
        error: "Daily file upload limit reached.",
        code: "DAILY_FILE_LIMIT_REACHED",
      },
      { status: 403 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedType = await fileType.fileTypeFromBuffer(
    buffer.subarray(0, 4100)
  )

  if (!detectedType || !ALLOWED_FILE_TYPES.includes(detectedType.mime)) {
    return NextResponse.json(
      { error: "File type not supported or doesn't match its extension" },
      { status: 400 }
    )
  }

  try {
    await ensureBucketExists()

    const fileExt = file.name.split(".").pop()
    const key = `uploads/${Math.random().toString(36).substring(2)}.${fileExt}`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const publicUrl = `${STORAGE_PUBLIC_URL}/${STORAGE_BUCKET}/${key}`

    await db.insert(chatAttachments).values({
      chatId,
      userId: session.user.id,
      fileUrl: publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    return NextResponse.json({
      name: file.name,
      contentType: file.type,
      url: publicUrl,
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: `Error uploading file: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
