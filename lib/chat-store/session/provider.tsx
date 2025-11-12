"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

const ChatSessionContext = createContext<{ chatId: string | null }>({
  chatId: null,
})

export const useChatSession = () => useContext(ChatSessionContext)

export function ChatSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [currentPath, setCurrentPath] = useState(pathname)
  
  // Override history methods to track URL changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function(...args) {
      originalPushState.apply(this, args)
      // Use queueMicrotask to avoid updates during render
      queueMicrotask(() => {
        setCurrentPath(window.location.pathname)
      })
    }

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args)
      // Use queueMicrotask to avoid updates during render
      queueMicrotask(() => {
        setCurrentPath(window.location.pathname)
      })
    }
    
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
  
  // Update when Next.js pathname changes
  useEffect(() => {
    setCurrentPath(pathname)
  }, [pathname])
  
  const chatId = useMemo(() => {
    if (currentPath?.startsWith("/c/")) {
      const id = currentPath.split("/c/")[1]?.split("/")[0]?.split("?")[0]
      return id || null
    }
    return null
  }, [currentPath])

  return (
    <ChatSessionContext.Provider value={{ chatId }}>
      {children}
    </ChatSessionContext.Provider>
  )
}
