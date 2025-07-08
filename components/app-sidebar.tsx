"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/firebase-auth"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import {
  Home,
  TestTube,
  HeadphonesIcon,
  Settings,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  BookOpen,
  DollarSign,
  Users,
  Eye,
  Ticket,
  FileText,
  Play,
  Code,
  type LucideIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Type definitions
interface NavigationChild {
  title: string
  url: string
  icon: LucideIcon
}

interface NavigationParent {
  title: string
  icon: LucideIcon
  isParent: true
  children: NavigationChild[]
}

interface NavigationSingle {
  title: string
  url: string
  icon: LucideIcon
  isParent?: false
}

type NavigationItem = NavigationParent | NavigationSingle

// Navigation structure with parent-child relationships
const navigationStructure: NavigationItem[] = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Onboarding",
    icon: BookOpen,
    isParent: true,
    children: [
      {
        title: "Churnzero",
        url: "/onboarding",
        icon: Users,
      },
    ],
  },
  {
    title: "Support",
    icon: HeadphonesIcon,
    isParent: true,
    children: [
      {
        title: "Overview",
        url: "/support",
        icon: Eye,
      },
      {
        title: "Tickets",
        url: "/support/tickets",
        icon: Ticket,
      },
    ],
  },
  {
    title: "Finance",
    icon: DollarSign,
    isParent: true,
    children: [
      {
        title: "Scripts",
        url: "/finance-operations",
        icon: FileText,
      },
    ],
  },
  {
    title: "QA",
    icon: TestTube,
    isParent: true,
    children: [
      {
        title: "Overview",
        url: "/qa",
        icon: Eye,
      },
      {
        title: "Playwright",
        url: "/qa/playwright",
        icon: Play,
      },
      {
        title: "Postman",
        url: "/qa/postman",
        icon: FileText,
      },
    ],
  },
  {
    title: "Engineering",
    icon: Code,
    isParent: true,
    children: [
      {
        title: "Overview",
        url: "/test-intelligence",
        icon: Eye,
      },
    ],
  },
]

// Account items
const accountItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Users",
    url: "/users",
    icon: User,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { state } = useSidebar()
  
  // Default dropdown states (all closed)
  const defaultDropdownStates = navigationStructure.reduce((acc, item) => {
    if (item.isParent) {
      acc[item.title] = false // Closed by default
    }
    return acc
  }, {} as Record<string, boolean>)
  
  // State to track which dropdowns are open
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(defaultDropdownStates)
  
  // State to remember dropdown states before collapse
  const [savedDropdownStates, setSavedDropdownStates] = useState<Record<string, boolean>>(defaultDropdownStates)

  // Handle sidebar state changes
  useEffect(() => {
    if (state === "collapsed") {
      // Save current state and close all dropdowns
      setSavedDropdownStates(openDropdowns)
      setOpenDropdowns({})
    } else if (state === "expanded") {
      // Restore saved state
      setOpenDropdowns(savedDropdownStates)
    }
  }, [state]) // Remove openDropdowns and savedDropdownStates from dependencies

  const toggleDropdown = (title: string) => {
    // Only allow toggling when sidebar is expanded
    if (state === "expanded") {
      setOpenDropdowns(prev => ({
        ...prev,
        [title]: !prev[title]
      }))
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      toast.error('Error signing out')
      console.error('Logout error:', error)
    }
  }

  const isChildActive = (children: NavigationChild[]) => {
    return children.some(child => pathname === child.url)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-sidebar-primary-foreground">
                  <TestTube className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Hapana Central</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationStructure.map((item) => (
                <div key={item.title}>
                  {item.isParent ? (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => toggleDropdown(item.title)}
                          className={cn(
                            "w-full justify-between",
                            isChildActive(item.children) && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                          </div>
                          {state === "expanded" && (
                            <>
                              {openDropdowns[item.title] ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronUp className="size-4" />
                              )}
                            </>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {openDropdowns[item.title] && state === "expanded" && (
                        <div className="ml-4 space-y-1">
                          {item.children.map((child) => (
                            <SidebarMenuItem key={child.title}>
                              <SidebarMenuButton
                                asChild
                                isActive={pathname === child.url}
                                size="sm"
                              >
                                <Link href={child.url}>
                                  <child.icon className="size-4" />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage 
                      src={user?.photoURL || ""} 
                      alt={user?.displayName || "User"} 
                    />
                    <AvatarFallback className="rounded-lg">
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.displayName || "User"}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
} 