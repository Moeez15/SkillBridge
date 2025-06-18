import axios, { AxiosInstance } from 'axios';
import { User, UserProfile, Match, Message, Conversation, Skill, AuthResponse } from '../types';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    bio?: string;
    location?: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data.user;
  },
};

// Users API
export const usersApi = {
  getUsers: async (params?: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[] }> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserProfile: async (userId: number): Promise<{ user: UserProfile }> => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  updateProfile: async (userId: number, userData: Partial<User>): Promise<{ message: string }> => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },

  addTeachingSkill: async (userId: number, skillData: {
    skillId: number;
    proficiencyLevel?: string;
    experienceYears?: number;
  }): Promise<{ message: string }> => {
    const response = await api.post(`/users/${userId}/teach-skills`, skillData);
    return response.data;
  },

  removeTeachingSkill: async (userId: number, skillId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/users/${userId}/teach-skills/${skillId}`);
    return response.data;
  },

  addLearningSkill: async (userId: number, skillData: {
    skillId: number;
    priorityLevel?: string;
  }): Promise<{ message: string }> => {
    const response = await api.post(`/users/${userId}/learn-skills`, skillData);
    return response.data;
  },

  removeLearningSkill: async (userId: number, skillId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/users/${userId}/learn-skills/${skillId}`);
    return response.data;
  },

  getAvailableSkills: async (params?: { category?: string }): Promise<{ skills: Skill[] }> => {
    const response = await api.get('/users/skills/available', { params });
    return response.data;
  },
};

// Matches API
export const matchesApi = {
  getMatches: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ matches: Match[] }> => {
    const response = await api.get('/matches', { params });
    return response.data;
  },

  createMatch: async (targetUserId: number): Promise<{ message: string; matchId: number; matchScore: number }> => {
    const response = await api.post('/matches', { targetUserId });
    return response.data;
  },

  getActiveMatches: async (): Promise<{ matches: any[] }> => {
    const response = await api.get('/matches/active');
    return response.data;
  },

  updateMatchStatus: async (matchId: number, status: string): Promise<{ message: string }> => {
    const response = await api.put(`/matches/${matchId}`, { status });
    return response.data;
  },

  getSuggestions: async (params?: { limit?: number }): Promise<{ suggestions: any[] }> => {
    const response = await api.get('/matches/suggestions', { params });
    return response.data;
  },
};

// Messages API
export const messagesApi = {
  getMessages: async (userId: number, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ messages: Message[] }> => {
    const response = await api.get(`/messages/${userId}`, { params });
    return response.data;
  },

  sendMessage: async (recipientId: number, content: string): Promise<{ message: Message }> => {
    const response = await api.post('/messages', { recipientId, content });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const response = await api.get('/messages/unread/count');
    return response.data;
  },

  getConversations: async (): Promise<{ conversations: Conversation[] }> => {
    const response = await api.get('/messages/conversations/list');
    return response.data;
  },

  markAsRead: async (userId: number): Promise<{ message: string; updatedCount: number }> => {
    const response = await api.put(`/messages/${userId}/read`);
    return response.data;
  },

  deleteMessage: async (messageId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },
};

export default api; 