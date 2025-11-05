"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { ChatDashboard } from "@/components/chat-dashboard"
import { Spinner } from "@/components/ui/spinner"

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Check if user is authenticated
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data?.user) {
        router.push("/auth/login")
      } else {
        setUser(data.user)
      }
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <ChatDashboard user={user} />
}
