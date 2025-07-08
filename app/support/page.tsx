"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAlgoliaSearch } from "@/lib/hooks/use-algolia-search"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GripVertical, Search, Clock, User, Calendar, ExternalLink, X } from "lucide-react"

interface BrandImpact {
  brandId: string
  brandName: string
  totalAffectedMembers: number
  impactLevel: 'low' | 'medium' | 'high' | 'critical'
  locationCount: number
}

interface HappyFoxTicket {
  id: string
  title: string
  status: 'open' | 'pending' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  customer: string
  created: Date
  updated: Date
}

interface JiraTicket {
  id: string
  key: string
  title: string
  status: 'to-do' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee: string
  created: Date
  updated: Date
}

interface Issue {
  id: string
  title: string
  description: string
  status: 'active' | 'monitoring' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  created: any // eslint-disable-line @typescript-eslint/no-explicit-any
  updated: any // eslint-disable-line @typescript-eslint/no-explicit-any
  
  // Impact summary
  totalAffectedBrands: number
  totalAffectedMembers: number
  totalAffectedLocations: number
  
  // Brand impacts
  brandImpacts: BrandImpact[]
  
  // Linked tickets (both counts and arrays)
  happyFoxTicketCount: number
  jiraTicketCount: number
  happyFoxTickets: HappyFoxTicket[]
  jiraTickets: JiraTicket[]
  
  // Intelligence
  requiresIncidentReport: boolean
  hasIncidentReports: boolean
  
  // Tags
  tags: string[]
}

export default function SupportPage() {
  // Initialize with saved width or default to 50%
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('support-page-left-width')
      return savedWidth ? parseFloat(savedWidth) : 50
    }
    return 50
  })
  const [isDragging, setIsDragging] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Real issue intelligence data
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  // Algolia search with 500ms debounce
  const { 
    results: searchResults, 
    isSearching, 
    hasSearched 
  } = useAlgoliaSearch(searchQuery, 500)

  // Fetch issues from API
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/issue-intelligence/issues?limit=50')
        const data = await response.json()
        
        if (data.success) {
          setIssues(data.data.issues)
        } else {
          console.error('Failed to fetch issues:', data.error)
          // Fallback to empty array
          setIssues([])
        }
      } catch (error) {
        console.error('Error fetching issues:', error)
        setIssues([])
      } finally {
        setLoading(false)
      }
    }

    fetchIssues()
  }, [])

  // Use Algolia search results when available, otherwise show all issues
  const displayedIssues = hasSearched && searchQuery.trim().length >= 2 
    ? searchResults.map(result => ({
        id: result.id,
        title: result.title,
        description: result.description,
        status: result.status as 'active' | 'monitoring' | 'resolved',
        priority: result.priority as 'low' | 'medium' | 'high' | 'urgent',
        category: result.category,
        created: result.created,
        updated: result.updated,
        totalAffectedBrands: result.totalAffectedBrands || 0,
        totalAffectedMembers: result.totalAffectedMembers || 0,
        totalAffectedLocations: result.totalAffectedLocations || 0,
        brandImpacts: [],
        happyFoxTicketCount: 0,
        jiraTicketCount: 0,
        happyFoxTickets: [],
        jiraTickets: [],
        requiresIncidentReport: false,
        hasIncidentReports: false,
        tags: result.tags || []
      }))
    : issues

  // Show loading state for search or initial load
  const isLoading = loading || (searchQuery.trim().length >= 2 && isSearching)

  // Clear selected issue when searching, otherwise set first issue as selected
  useEffect(() => {
    if (hasSearched && searchQuery.trim().length >= 2) {
      // Clear selection when actively searching
      setSelectedIssue(null)
    } else if (displayedIssues.length > 0 && !selectedIssue && !hasSearched) {
      // Set first issue as selected only when not searching
      setSelectedIssue(displayedIssues[0])
    }
  }, [displayedIssues, selectedIssue, hasSearched, searchQuery])

  // Save width to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('support-page-left-width', leftWidth.toString())
    }
  }, [leftWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
    
    // Constrain the width between 20% and 80%
    const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80)
    setLeftWidth(constrainedWidth)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue)
    // On mobile, open the sheet
    if (window.innerWidth < 768) {
      setIsSheetOpen(true)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="destructive">Active</Badge>
      case 'monitoring':
        return <Badge className="bg-yellow-100 text-yellow-800">Monitoring</Badge>
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800">Resolved</Badge>
      case 'open':
        return <Badge className="bg-red-100 text-red-800">Open</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'to-do':
        return <Badge variant="outline">To Do</Badge>
      case 'done':
        return <Badge className="bg-green-100 text-green-800">Done</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
      case 'low':
        return <Badge variant="outline">Low</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const formatTimestamp = (date: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const now = new Date()
    const dateObj = date?.toDate ? date.toDate() : new Date(date)
    const diff = now.getTime() - dateObj.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Component for issue details content (used in both desktop right column and mobile sheet)
  // Loading skeleton for issues list
  const IssuesListSkeleton = () => (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-4 border-b border-border">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // Loading skeleton for issue details
  const IssueDetailsSkeleton = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>

      <Separator />

      {/* Impact Summary */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Brand Impacts */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Tickets */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const IssueDetailsContent = ({ issue }: { issue: Issue }) => (
    <div className="space-y-6">
      {/* Issue Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{issue.title}</h1>
            <p className="text-muted-foreground">{issue.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(issue.status)}
            {getPriorityBadge(issue.priority)}
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Created {formatTimestamp(issue.created)}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Updated {formatTimestamp(issue.updated)}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {issue.totalAffectedMembers} affected members
          </div>
        </div>
      </div>

      <Separator />

      {/* HappyFox Tickets */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          HappyFox Tickets ({issue.happyFoxTicketCount})
        </h2>
        
        {issue.happyFoxTickets.length > 0 ? (
          <div className="space-y-3">
            {issue.happyFoxTickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{ticket.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {ticket.customer}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-medium text-blue-600">{ticket.id}</span>
                    <div className="flex items-center gap-4">
                      <span>Created {formatTimestamp(ticket.created)}</span>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No HappyFox tickets linked to this issue</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Jira Tickets */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Jira Tickets ({issue.jiraTicketCount})
        </h2>
        
        {issue.jiraTickets.length > 0 ? (
          <div className="space-y-3">
            {issue.jiraTickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{ticket.title}</CardTitle>
                      <CardDescription className="text-sm">
                        Assigned to {ticket.assignee}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-medium text-orange-600">{ticket.key}</span>
                    <div className="flex items-center gap-4">
                      <span>Created {formatTimestamp(ticket.created)}</span>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No Jira tickets linked to this issue</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  return (
    <div 
      ref={containerRef}
      className="flex h-screen relative"
      style={{ minHeight: 0 }}
    >
      {/* Left Column - Issues List */}
      <div 
        className="border-r border-border bg-background flex flex-col md:w-auto w-full"
        style={{ width: window.innerWidth >= 768 ? `${leftWidth}%` : '100%' }}
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-4 px-4 border-b border-border">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Support</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isSearching && searchQuery.trim().length >= 2 && (
              <div className="absolute right-8 top-2.5">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <IssuesListSkeleton />
          ) : (
            displayedIssues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedIssue?.id === issue.id ? 'bg-muted' : ''
                }`}
                onClick={() => handleIssueClick(issue)}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-sm leading-tight">{issue.title}</h3>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {formatTimestamp(issue.updated)}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {issue.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(issue.status)}
                      {getPriorityBadge(issue.priority)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {issue.totalAffectedMembers}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Drag Handle - Hidden on mobile */}
      <div 
        className="hidden md:flex items-center justify-center w-2 bg-border hover:bg-muted cursor-col-resize relative group h-10 self-center rounded-sm -ml-1"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      </div>

      {/* Right Column - Issue Details (Hidden on mobile) */}
      <div 
        className="bg-background flex-1 overflow-y-auto hidden md:block"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {isLoading ? (
          <div className="p-6">
            <IssueDetailsSkeleton />
          </div>
        ) : selectedIssue ? (
          <div className="p-6">
            <IssueDetailsContent issue={selectedIssue} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              {hasSearched && searchQuery.trim().length >= 2 
                ? "Select an issue from search results to view details" 
                : "Select an issue to view details"}
            </p>
          </div>
        )}
      </div>

      {/* Mobile Sheet for Issue Details */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Issue Details</SheetTitle>
          </SheetHeader>
          {isLoading ? (
            <div className="pb-6">
              <IssueDetailsSkeleton />
            </div>
          ) : selectedIssue ? (
            <div className="pb-6">
              <IssueDetailsContent issue={selectedIssue} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground text-center">
                {hasSearched && searchQuery.trim().length >= 2 
                  ? "Select an issue from search results to view details" 
                  : "Select an issue to view details"}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
} 