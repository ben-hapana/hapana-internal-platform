# Hapana Central Engineering Dashboard

A comprehensive platform engineering dashboard for QA automation and support management, built with Next.js, shadcn/ui, and integrated with Playwright, HappyFox, and Jira.

## 🚀 Features

### QA Testing Module
- **Automated Test Execution**: Run Playwright tests headlessly across multiple environments
- **Real-time Monitoring**: View test status and results in real-time
- **Environment Management**: Separate testing for Production, Staging, and Development
- **Test History**: Track test results and performance over time
- **Integrated Reporting**: Built-in test reports with screenshots and videos

### Support Management Module
- **HappyFox Integration**: Fetch and display support tickets
- **Jira Integration**: Create and manage development tickets
- **AI-Powered Analysis**: Use OpenAI to analyze ticket sentiment and categorize issues
- **Duplicate Detection**: Identify similar tickets to prevent duplicate work
- **Smart Recommendations**: AI-suggested actions for ticket resolution

### Dashboard Features
- **Beautiful UI**: Modern interface built with shadcn/ui components
- **Real-time Updates**: Live status updates for tests and tickets
- **Role-based Access**: Firebase authentication with proper permissions
- **Responsive Design**: Works perfectly on desktop and mobile
- **Dark/Light Mode**: Supports both themes

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS, Lucide React
- **Authentication**: Firebase Auth with Google OAuth
- **Database**: Firestore (for storing configurations and results)
- **Testing**: Playwright for automated browser testing
- **AI Integration**: OpenAI GPT-3.5/4 for ticket analysis
- **External APIs**: HappyFox API, Jira REST API
- **Deployment**: Google Cloud Run, Firebase Hosting

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- OpenAI API key
- HappyFox API credentials
- Jira API credentials
- Google Cloud Platform account (for deployment)

## 🔧 Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp env.example .env.local
```

Update `.env.local` with your actual credentials:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# HappyFox Configuration
HAPPYFOX_API_KEY=your_happyfox_api_key
HAPPYFOX_API_SECRET=your_happyfox_api_secret
HAPPYFOX_SUBDOMAIN=your_happyfox_subdomain

# Jira Configuration
JIRA_HOST=your_jira_instance.atlassian.net
JIRA_USERNAME=your_jira_username
JIRA_API_TOKEN=your_jira_api_token

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Playwright Configuration
PLAYWRIGHT_BASE_URL=https://qacore.hapana.com
PLAYWRIGHT_HEADLESS=true
```

### 2. Install Dependencies

```bash
# Install main application dependencies
npm install

# Install Playwright browsers
npm run playwright:install
```

### 3. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication and add Google as a sign-in provider
3. Create a Firestore database
4. Add your domain to authorized domains in Authentication settings
5. Download the service account key for server-side operations

### 4. HappyFox API Setup

1. Log in to your HappyFox admin panel
2. Go to Apps & Integrations > API
3. Create a new API key and secret
4. Note your subdomain (e.g., if your HappyFox URL is `mycompany.happyfox.com`, your subdomain is `mycompany`)

### 5. Jira API Setup

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
2. Create an API token
3. Use your email as username and the token as password
4. Update the Jira project key in `/app/api/jira/create/route.ts`

### 6. Playwright Configuration

The Playwright tests are located in the `/playwright` directory. Update the configuration in `playwright.config.ts`:

```typescript
// Update base URLs for your environments
const baseUrls: Record<string, string> = {
  'production': 'https://qacore.hapana.com',
  'staging': 'https://staging.qacore.hapana.com', 
  'development': 'https://dev.qacore.hapana.com'
}
```

## 🚀 Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Running Tests

```bash
# Run all Playwright tests
npm run playwright:test

# Run tests in headed mode (with browser UI)
npm run playwright:test -- --headed

# Run specific test file
npm run playwright:test tests/login.spec.ts

# Open Playwright UI for debugging
npm run playwright:ui
```

## 📁 Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── playwright/         # Playwright test execution
│   │   ├── support/           # Support ticket analysis
│   │   └── jira/              # Jira integration
│   ├── qa/                    # QA dashboard page
│   ├── support/               # Support dashboard page
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home dashboard
├── components/
│   ├── dashboard/             # Dashboard layout components
│   ├── navigation/            # Navigation components
│   └── ui/                    # shadcn/ui components
├── lib/
│   └── utils.ts               # Utility functions
├── playwright/                # Playwright test files
│   ├── tests/
│   │   ├── login.spec.ts
│   │   └── reporting.spec.ts
│   └── playwright.config.ts
└── firebase/
    └── firebase.ts            # Firebase configuration
```

## 🔐 Authentication Flow

1. Users sign in with Google OAuth through Firebase Auth
2. Role-based access control determines dashboard permissions
3. API routes are protected with authentication middleware
4. User sessions are managed with Firebase Auth state

## 🧪 QA Module Usage

### Running Individual Tests

1. Navigate to the QA dashboard (`/qa`)
2. Select the test you want to run
3. Choose the target environment
4. Click "Run Test" to execute
5. Monitor real-time status and results

### Running All Tests

1. Click "Run All Tests" in the QA dashboard
2. Tests will execute across all configured environments
3. View aggregated results and detailed reports
4. Download test artifacts (screenshots, videos)

## 🎫 Support Module Usage

### Analyzing Tickets

1. Navigate to the Support dashboard (`/support`)
2. View tickets from HappyFox automatically synced
3. Click "AI Analyze" to get intelligent insights
4. Review suggested actions and similar tickets
5. Create Jira tickets for development work

### Creating Jira Tickets

1. From any HappyFox ticket, click "Create Jira"
2. The system will automatically format the ticket
3. Priority and labels are mapped appropriately
4. Link between support and development tickets is maintained

## 🚀 Deployment

### Google Cloud Run

1. Build the Docker image:
```bash
docker build -t hapana-platform .
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy hapana-platform \
  --image gcr.io/your-project/hapana-platform \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Variables

Ensure all environment variables are configured in your deployment environment.

## 🔧 Configuration

### Adding New Test Environments

Update the environment configuration in:
- `/app/api/playwright/run/route.ts`
- `/app/qa/page.tsx`
- `playwright.config.ts`

### Customizing AI Analysis

Modify the OpenAI prompts in `/app/api/support/analyze/route.ts` to customize:
- Sentiment analysis criteria
- Category classifications
- Suggested actions
- Priority recommendations

### Adding New Integrations

Create new API routes in `/app/api/` for additional tools:
- Slack notifications
- Microsoft Teams alerts
- Additional ticketing systems
- Monitoring tools

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

This project is proprietary to Hapana. All rights reserved.

## 🆘 Support

For technical support or questions:
- Create an issue in the repository
- Contact the Platform Engineering team
- Check the internal documentation wiki

---

**Built with ❤️ by the Hapana Central Engineering Team** 