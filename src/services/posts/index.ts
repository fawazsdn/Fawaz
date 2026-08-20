import type { Comment, Post, PostType } from '@/models';
import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

export interface CreatePostInput {
  type: PostType;
  textAr: string;
  images: string[];
  audience: 'neighborhood' | 'city';
}

export interface PostService {
  getFeed(neighborhoodId: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(input: CreatePostInput): Promise<Post>;
  reactToPost(postId: string, type: 'like' | 'helpful'): Promise<void>;
  toggleSave(postId: string): Promise<void>;
  getComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, textAr: string, parentId?: string): Promise<Comment>;
  editComment(commentId: string, textAr: string): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  toggleCommentLike(commentId: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  getSavedPosts(userId: string): Promise<Post[]>;
}

export const postService: PostService = {
  async getFeed(neighborhoodId) {
    const blocked = useStore.getState().blockedUserIds;
    const posts = useStore
      .getState()
      .posts.filter((p) => p.neighborhoodId === neighborhoodId && !blocked.includes(p.authorId))
      .sort((a, b) => (a.pinned === b.pinned ? +new Date(b.createdAt) - +new Date(a.createdAt) : a.pinned ? -1 : 1));
    return mockDelay(posts);
  },
  async getPost(id) {
    return mockDelay(useStore.getState().posts.find((p) => p.id === id));
  },
  async createPost(input) {
    return mockDelay(useStore.getState().createPost(input), 300);
  },
  async reactToPost(postId, type) {
    useStore.getState().toggleReaction(postId, type);
    return mockDelay(undefined, 80);
  },
  async toggleSave(postId) {
    useStore.getState().toggleSavePost(postId);
    return mockDelay(undefined, 80);
  },
  async getComments(postId) {
    return mockDelay(
      useStore
        .getState()
        .comments.filter((c) => c.postId === postId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
      280,
    );
  },
  async addComment(postId, textAr, parentId) {
    return mockDelay(useStore.getState().addComment(postId, textAr, parentId), 250);
  },
  async editComment(commentId, textAr) {
    useStore.getState().editComment(commentId, textAr);
    return mockDelay(undefined, 150);
  },
  async deleteComment(commentId) {
    useStore.getState().deleteComment(commentId);
    return mockDelay(undefined, 150);
  },
  async toggleCommentLike(commentId) {
    useStore.getState().toggleCommentLike(commentId);
    return mockDelay(undefined, 80);
  },
  async deletePost(postId) {
    useStore.getState().deletePost(postId);
    return mockDelay(undefined, 200);
  },
  async getSavedPosts(userId) {
    return mockDelay(useStore.getState().posts.filter((p) => p.savedBy.includes(userId)));
  },
};
