export type LessonBlockType = "heading" | "subheading" | "definition" | "paragraph";

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface MindMapNode {
  title: string;
  children?: MindMapNode[];
}

export type CourseStatus = "recording" | "processing" | "done" | "error";

export interface Course {
  id: string;
  user_id: string;
  subject_id: string | null;
  course_number: number;
  title: string | null;
  status: CourseStatus;
  audio_path: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  content: LessonBlock[];
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface MindMap {
  id: string;
  course_id: string;
  data: MindMapNode;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_premium: boolean;
  is_admin: boolean;
  created_at: string;
}

/** Un admin a un accès illimité, comme un compte premium. */
export function hasFullAccess(profile: Pick<Profile, "is_premium" | "is_admin"> | null): boolean {
  return !!profile && (profile.is_premium || profile.is_admin);
}

/** Nombre de blocs visibles pour un utilisateur sans accès complet (modèle freemium). */
export const FREE_BLOCK_LIMIT = 3;
/** Nombre de questions de quiz visibles pour un utilisateur sans accès complet. */
export const FREE_QUIZ_LIMIT = 2;
/** Nombre de branches de carte mentale visibles pour un utilisateur sans accès complet. */
export const FREE_MINDMAP_BRANCHES = 1;
