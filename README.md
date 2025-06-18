# SkillBridge – Peer-to-Peer Learning Platform

A modern web application that connects students and professionals to exchange knowledge and skills. Users can list what they can teach and what they want to learn, and the platform matches users with complementary skills.

## Features

- **User Profiles**: Create detailed profiles with skills you can teach and want to learn
- **Smart Matching**: AI-powered algorithm to match users with complementary skills
- **Real-time Chat**: Built-in messaging system for communication between matched users
- **Skill Categories**: Organized skill categories for easy discovery
- **Rating System**: Rate and review your learning experiences
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: React.js with TypeScript, Tailwind CSS, React Router
- **Backend**: Node.js with Express, Socket.io for real-time features
- **Database**: SQLite (for development), PostgreSQL (for production)
- **Authentication**: JWT tokens
- **Real-time**: Socket.io for live messaging

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SkillBridge
```

2. Install all dependencies:
```bash
npm run install-all
```

3. Start the development servers:
```bash
npm run dev
```

This will start both the backend server (port 5000) and frontend development server (port 3000).

### Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=sqlite:./skillbridge.db
```

## Project Structure

```
SkillBridge/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   └── types/         # TypeScript type definitions
├── server/                 # Node.js backend
│   ├── routes/            # API routes
│   ├── models/            # Database models
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
└── README.md
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/matches` - Get user matches
- `POST /api/messages` - Send message
- `GET /api/messages/:userId` - Get conversation messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 