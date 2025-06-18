export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  description?: string;
}

export interface UserTeachSkill extends Skill {
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  experienceYears: number;
}

export interface UserLearnSkill extends Skill {
  priorityLevel: 'low' | 'medium' | 'high';
}

export interface UserProfile extends User {
  teachSkills: UserTeachSkill[];
  learnSkills: UserLearnSkill[];
  rating: number;
  totalRatings: number;
}

export interface Match {
  id: number;
  username: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  createdAt: string;
  teachMatchCount: number;
  learnMatchCount: number;
  totalMatchScore: number;
  avgRating: number;
  totalRatings: number;
  teachSkills: UserTeachSkill[];
  learnSkills: UserLearnSkill[];
}

export interface Message {
  id: number;
  senderId: number;
  recipientId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderUsername: string;
  senderFullName: string;
  senderAvatar?: string;
}

export interface Conversation {
  otherUserId: number;
  lastMessageTime: string;
  messageCount: number;
  unreadCount: number;
  username: string;
  fullName: string;
  avatarUrl?: string;
  location?: string;
  lastMessageContent: string;
  lastMessageSenderId: number;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
} 