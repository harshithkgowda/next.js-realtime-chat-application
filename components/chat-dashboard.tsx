"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, LogOut, MessageSquare, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { ChatWindow } from "@/components/chat-window"

interface Profile {
  id: string
  email: string
  displayName: string
  createdAt: string
}

interface ConversationWithUser {
  id: string
  other_user: Profile
  last_message: string | null
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function ChatDashboard({ user }: { user: User }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([])
  const [conversations, setConversations] = useState<ConversationWithUser[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [showAllUsers, setShowAllUsers] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadCurrentProfile()
    loadAllUsers()
    loadConversations()

    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Profile",
        },
        (payload) => {
          const newProfile = payload.new as Profile
          if (newProfile.id !== user.id) {
            setAllUsers((prev) => [...prev, newProfile])
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setFilteredUsers(allUsers)
    } else {
      const filtered = allUsers.filter(
        (profile) =>
          profile.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          profile.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, allUsers])

  const loadCurrentProfile = async () => {
    const { data } = await supabase.from("Profile").select("*").eq("id", user.id).single()
    if (data) setCurrentProfile(data)
  }

  const loadAllUsers = async () => {
    const { data } = await supabase.from("Profile").select("*").neq("id", user.id).order("displayName")
    if (data) {
      setAllUsers(data)
      setFilteredUsers(data)
    }
  }

  const loadConversations = async () => {
    const { data: participantData } = await supabase
      .from("ConversationParticipant")
      .select("conversationId")
      .eq("userId", user.id)

    if (!participantData) return

    const conversationIds = participantData.map((p) => p.conversationId)
    if (conversationIds.length === 0) return

    const { data: otherParticipants } = await supabase
      .from("ConversationParticipant")
      .select("conversationId, userId, Profile(*)")
      .in("conversationId", conversationIds)
      .neq("userId", user.id)

    if (!otherParticipants) return

    const { data: messagesData } = await supabase
      .from("Message")
      .select("conversationId, content, createdAt")
      .in("conversationId", conversationIds)
      .order("createdAt", { ascending: false })

    const convs: ConversationWithUser[] = otherParticipants.map((p: any) => {
      const lastMsg = messagesData?.find((m) => m.conversationId === p.conversationId)
      return {
        id: p.conversationId,
        other_user: p.Profile,
        last_message: lastMsg?.content || null,
      }
    })

    setConversations(convs)
  }

  const handleUserSelect = async (profile: Profile) => {
    console.log("[v0] User selected:", profile.displayName)
    setSelectedUser(profile)
    setSelectedConversation(null)
    setIsLoadingConversation(true)

    try {
      const { data, error } = await supabase.rpc("create_conversation_with_participants", {
        user1_id: user.id,
        user2_id: profile.id,
      })

      console.log("[v0] Conversation creation result:", { data, error })

      if (error) throw error

      if (data) {
        setSelectedConversation(data)
        loadConversations()
      }
    } catch (error: any) {
      console.error("[v0] Error creating conversation:", error)
      alert(`Failed to create conversation: ${error.message}`)
      setSelectedUser(null)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const handleConversationSelect = (conv: ConversationWithUser) => {
    setSelectedConversation(conv.id)
    setSelectedUser(conv.other_user)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {currentProfile ? getInitials(currentProfile.displayName) : "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-foreground">{currentProfile?.displayName || "User"}</h2>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setShowAllUsers(true)}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              showAllUsers ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            All Users ({allUsers.length})
          </button>
          <button
            onClick={() => setShowAllUsers(false)}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              !showAllUsers
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-2" />
            Chats ({conversations.length})
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={showAllUsers ? "Search users..." : "Search conversations..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
        </div>

        {/* User/Conversation List */}
        <ScrollArea className="flex-1">
          {showAllUsers ? (
            <div className="p-2">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No users found" : "No other users registered yet"}
                  </p>
                </div>
              ) : (
                filteredUsers.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleUserSelect(profile)}
                    className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors text-left mb-1"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-muted text-foreground">
                        {getInitials(profile.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{profile.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No conversations yet. Click on a user from "All Users" to start chatting.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleConversationSelect(conv)}
                    className={`w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors text-left mb-1 ${
                      selectedConversation === conv.id ? "bg-accent" : ""
                    }`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-muted text-foreground">
                        {getInitials(conv.other_user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{conv.other_user.displayName}</p>
                      <p className="text-sm text-muted-foreground truncate">{conv.last_message || "No messages yet"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <ChatWindow
            conversationId={selectedConversation}
            currentUserId={user.id}
            otherUser={selectedUser}
            isLoadingConversation={isLoadingConversation}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Select a user to chat</h3>
              <p className="text-muted-foreground">Choose a user from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
