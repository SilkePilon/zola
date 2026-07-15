import { APP_DOMAIN } from "@/lib/config"
import { db } from "@/lib/db/client"
import { mapMessageRow } from "@/lib/db/mappers"
import { chats, messages } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Article from "./article"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>
}): Promise<Metadata> {
  const { chatId } = await params

  const [chat] = await db
    .select({ title: chats.title, createdAt: chats.createdAt })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  const title = chat?.title || "Chat"
  const description = "A chat in Zola"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_DOMAIN}/share/${chatId}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ShareChat({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params

  const [chatData] = await db
    .select({ id: chats.id, title: chats.title, createdAt: chats.createdAt })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chatData) {
    redirect("/")
  }

  const messagesData = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))

  return (
    <Article
      messages={messagesData.map(mapMessageRow)}
      date={chatData.createdAt ? chatData.createdAt.toISOString() : ""}
      title={chatData.title || ""}
      subtitle={"A conversation in Zola"}
    />
  )
}
