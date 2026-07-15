import { toast } from "@/components/ui/toast"
import * as fileType from "file-type"
import { fetchClient, getCsrfHeader } from "./fetch"

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

export type Attachment = {
  name: string
  contentType: string
  url: string
}

export async function validateFile(
  file: File
): Promise<{ isValid: boolean; error?: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  const buffer = await file.arrayBuffer()
  const type = await fileType.fileTypeFromBuffer(
    Buffer.from(buffer.slice(0, 4100))
  )

  if (!type || !ALLOWED_FILE_TYPES.includes(type.mime)) {
    return {
      isValid: false,
      error: "File type not supported or doesn't match its extension",
    }
  }

  return { isValid: true }
}

export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url,
  }
}

export class FileUploadLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_FILE_LIMIT_REACHED"
  }
}

async function uploadFile(file: File, chatId: string): Promise<Attachment> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("chatId", chatId)

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: getCsrfHeader(),
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    if (data.code === "DAILY_FILE_LIMIT_REACHED") {
      throw new FileUploadLimitError(data.error)
    }
    throw new Error(data.error || "Error uploading file")
  }

  return data as Attachment
}

export async function processFiles(
  files: File[],
  chatId: string,
  _userId: string
): Promise<Attachment[]> {
  const attachments: Attachment[] = []

  for (const file of files) {
    const validation = await validateFile(file)
    if (!validation.isValid) {
      console.warn(`File ${file.name} validation failed:`, validation.error)
      toast({
        title: "File validation failed",
        description: validation.error,
        status: "error",
      })
      continue
    }

    try {
      const attachment = await uploadFile(file, chatId)
      attachments.push(attachment)
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      if (error instanceof FileUploadLimitError) {
        throw error
      }
    }
  }

  return attachments
}

export async function checkFileUploadLimit(_userId: string) {
  const res = await fetchClient("/api/file-upload-limit")
  const data = await res.json()

  if (!res.ok) {
    if (data.code === "DAILY_FILE_LIMIT_REACHED") {
      throw new FileUploadLimitError(data.error)
    }
    throw new Error(data.error || "Failed to check upload limit")
  }

  return data.count
}
