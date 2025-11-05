"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface Profile {
  id: string
  email: string
  displayName: string
}

interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
}

interface ChatWindowProps {
  conversationId: string | null
  currentUserId: string
  otherUser: Profile
  isLoadingConversation?: boolean
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffInHours < 24) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
}

export function ChatWindow({ conversationId, currentUserId, otherUser, isLoadingConversation }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (conversationId) {
      loadMessages()
      subscribeToMessages()
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    const { data } = await supabase
      .from("Message")
      .select("*")
      .eq("conversationId", conversationId)
      .order("createdAt", { ascending: true })

    if (data) {
      setMessages(data)
    }
  }

  const subscribeToMessages = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    channelRef.current = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id)
            if (exists) return prev
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!conversationId || !newMessage.trim() || isLoading) return

    setIsLoading(true)
    const messageContent = newMessage.trim()
    setNewMessage("")

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: conversationId,
      senderId: currentUserId,
      content: messageContent,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])

    try {
      const { data, error } = await supabase
        .from("Message")
        .insert({
          id: crypto.randomUUID(),
          conversationId: conversationId,
          senderId: currentUserId,
          content: messageContent,
          createdAt: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error("[v0] Error details:", error)
        throw error
      }

      if (data) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticMessage.id ? data : m)))
      }
    } catch (error: any) {
      console.error("[v0] Error sending message:", error)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
      alert(`Failed to send message: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Chat Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 bg-background shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-muted text-foreground">{getInitials(otherUser.displayName)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-foreground">{otherUser.displayName}</h3>
          <p className="text-xs text-muted-foreground">{otherUser.email}</p>
        </div>
      </div>

      {isLoadingConversation ? (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Setting up conversation...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <div className="space-y-4 min-h-full flex flex-col justify-end">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.senderId === currentUserId
                  return (
                    <div key={message.id} className={`flex gap-3 ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-muted text-foreground text-xs">
                          {isCurrentUser ? "You" : getInitials(otherUser.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col gap-1 max-w-[70%] ${isCurrentUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isCurrentUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          <p className="text-sm leading-relaxed break-words">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground px-1">{formatTime(message.createdAt)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border bg-background shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isLoading || !conversationId}
                className="flex-1 bg-secondary border-border"
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !newMessage.trim() || !conversationId}
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
