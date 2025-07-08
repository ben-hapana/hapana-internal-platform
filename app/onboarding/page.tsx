"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BookOpen, 
  CheckCircle, 
  Users, 
  Settings, 
  TestTube, 
  HeadphonesIcon,
  ArrowRight,
  Play
} from "lucide-react"

export default function OnboardingPage() {
  const onboardingSteps = [
    {
      id: 1,
      title: "Welcome to Hapana Central",
      description: "Get familiar with our internal platform for QA, support, and issue intelligence",
      icon: BookOpen,
      status: "completed" as const,
      estimatedTime: "5 min"
    },
    {
      id: 2,
      title: "Set Up Your Profile",
      description: "Configure your user profile and notification preferences",
      icon: Users,
      status: "completed" as const,
      estimatedTime: "10 min"
    },
    {
      id: 3,
      title: "Explore QA Testing",
      description: "Learn how to run automated tests across different environments",
      icon: TestTube,
      status: "in-progress" as const,
      estimatedTime: "15 min"
    },
    {
      id: 4,
      title: "Support Dashboard",
      description: "Understand how to analyze support tickets and create Jira issues",
      icon: HeadphonesIcon,
      status: "pending" as const,
      estimatedTime: "20 min"
    },
    {
      id: 5,
      title: "Issue Intelligence",
      description: "Master the issue intelligence system for detecting and managing global issues",
      icon: Settings,
      status: "pending" as const,
      estimatedTime: "25 min"
    }
  ]

  const quickActions = [
    {
      title: "Run Your First Test",
      description: "Execute a QA test to see the platform in action",
      href: "/qa",
      icon: TestTube,
      color: "bg-blue-500"
    },
    {
      title: "Browse Support Tickets",
      description: "Explore the support dashboard and search functionality",
      href: "/support",
      icon: HeadphonesIcon,
      color: "bg-green-500"
    },
    {
      title: "View Issue Intelligence",
      description: "Check out how we detect and manage cross-brand issues",
      href: "/test-intelligence",
      icon: Settings,
      color: "bg-purple-500"
    }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      case 'in-progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
          <Play className="w-3 h-3 mr-1" />
          In Progress
        </Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex h-16 items-center gap-4 px-4 border-b border-border">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Onboarding</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Hapana Central</h1>
          <p className="text-muted-foreground">
            Your one-stop platform for QA testing, support management, and issue intelligence. 
            Follow the steps below to get started.
          </p>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Onboarding Progress
            </CardTitle>
            <CardDescription>
              Complete these steps to master the Hapana Central platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {onboardingSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    step.status === 'completed' ? 'bg-green-100 text-green-600' :
                    step.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{step.title}</h3>
                      {getStatusBadge(step.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <p className="text-xs text-muted-foreground">Estimated time: {step.estimatedTime}</p>
                  </div>

                  <Button 
                    variant={step.status === 'pending' ? 'outline' : 'ghost'}
                    size="sm"
                    disabled={step.status === 'completed'}
                  >
                    {step.status === 'completed' ? 'Completed' :
                     step.status === 'in-progress' ? 'Continue' : 'Start'}
                    {step.status !== 'completed' && <ArrowRight className="w-4 h-4 ml-1" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Jump straight into the platform features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <Card key={action.title} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg text-white ${action.color}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href={action.href}>
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>
              Resources to help you get the most out of Hapana Central
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Documentation</h4>
                <p className="text-sm text-muted-foreground">
                  Comprehensive guides and API documentation
                </p>
                <Button variant="link" className="h-auto p-0 text-blue-600">
                  View Documentation →
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Support Team</h4>
                <p className="text-sm text-muted-foreground">
                  Get help from our internal support team
                </p>
                <Button variant="link" className="h-auto p-0 text-blue-600">
                  Contact Support →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 