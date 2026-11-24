import { z } from 'zod';

export const IdSchema = z.string().uuid();
export const RoleSchema = z.enum(['student', 'teacher', 'admin']);
/** Types the document reader and the AI generator produce. */
export const QuestionTypeSchema = z.enum(['single', 'multiple', 'boolean', 'fill', 'short']);
/** Every type a stored/published question may have (ordering & matching are teacher-authored). */
export const AnyQuestionTypeSchema = z.enum(['single', 'multiple', 'boolean', 'fill', 'short', 'ordering', 'matching']);
export const MatchPairSchema = z.strictObject({ leftId: z.string().uuid(), rightId: z.string().uuid() });
export const AnswerOriginSchema = z.enum(['document', 'teacher', 'ai_suggested']);
export const DifficultySchema = z.enum(['recognition', 'comprehension', 'application']);
const EmailSchema = z.email().max(254).transform(v => v.toLowerCase());
const PasswordSchema = z.string().min(12).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password exceeds bcrypt byte limit');
export const RegisterSchema = z.strictObject({
  email: EmailSchema, password: PasswordSchema, name: z.string().trim().min(1).max(100),
  role: z.enum(['student', 'teacher']).default('student'),
});
export const LoginSchema = z.strictObject({ email: EmailSchema, password: z.string().min(1).max(200) });
export const TokenSchema = z.strictObject({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const ForgotPasswordSchema = z.strictObject({ email: EmailSchema });
export const ResetPasswordSchema = TokenSchema.extend({ password: PasswordSchema });
export const UserSchema = z.strictObject({ id: IdSchema, email: EmailSchema, name: z.string(), role: RoleSchema });
export type UserDTO = z.infer<typeof UserSchema>;

export const PaginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const DocumentStatusSchema = z.enum(['uploaded', 'extracting', 'ready', 'failed', 'needs_ocr']);
export const DocumentSchema = z.strictObject({
  id: IdSchema, title: z.string(), fileType: z.string(), size: z.number().int().nonnegative(),
  status: DocumentStatusSchema, createdAt: z.iso.datetime(),
});
export const DocumentPatchSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(), rawText: z.string().min(1).max(2_000_000).optional(),
  revision: z.number().int().nonnegative().optional(),
}).refine(v => v.title !== undefined || v.rawText !== undefined, 'No changes supplied');
export const DocumentChunkSchema = z.strictObject({ id: IdSchema, chunkIndex: z.number().int(), content: z.string(), pageNumber: z.number().int().nullable() });
export const DocumentDetailSchema = DocumentSchema.extend({ rawText: z.string().nullable(), chunks: z.array(DocumentChunkSchema), revision: z.number().int().nonnegative(), analysis: z.unknown().optional(), extraction: z.unknown().optional(), tools: z.object({ layoutReader: z.boolean() }).optional() });
export type DocumentDTO = z.infer<typeof DocumentSchema>;

export const SourceRefSchema = z.strictObject({ chunkId: IdSchema, quote: z.string().trim().min(1).max(2000) });
export const OptionSchema = z.strictObject({ id: IdSchema, text: z.string().trim().min(1).max(4000) });
export const QuestionSchema = z.strictObject({
  id: IdSchema, type: AnyQuestionTypeSchema, stem: z.string().trim().min(1).max(8000),
  options: z.array(OptionSchema).max(12), correctOptionIds: z.array(IdSchema).max(12),
  acceptedAnswers: z.array(z.string().trim().min(1).max(4000)).max(20),
  explanation: z.string().trim().min(1).max(8000), points: z.number().positive().max(100),
  difficulty: DifficultySchema, topic: z.string().max(200), answerOrigin: AnswerOriginSchema,
  sourceRefs: z.array(SourceRefSchema).min(1).max(20), reviewed: z.boolean(),
  pairs: z.array(MatchPairSchema).max(6).optional(),
  audioAssetId: IdSchema.nullable().optional(),
  rubric: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
}).superRefine((q, ctx) => {
  const ids = new Set(q.options.map(o => o.id));
  const correct = new Set(q.correctOptionIds);
  if (ids.size !== q.options.length || correct.size !== q.correctOptionIds.length || q.correctOptionIds.some(id => !ids.has(id))) {
    ctx.addIssue({ code: 'custom', message: 'Options and answer keys must be unique and refer to the same question' });
  }
  if (q.type !== 'matching' && q.pairs?.length) ctx.addIssue({ code: 'custom', message: 'Only matching questions have pairs' });
  if (q.type === 'ordering') {
    // correctOptionIds lists every option once, in the correct order.
    if (q.options.length < 3 || q.options.length > 8 || correct.size !== q.options.length || q.acceptedAnswers.length) ctx.addIssue({ code: 'custom', message: 'Ordering questions need 3-8 items, all in the answer order' });
  } else if (q.type === 'matching') {
    const pairs = q.pairs ?? [];
    const used = pairs.flatMap(p => [p.leftId, p.rightId]);
    if (pairs.length < 2 || q.options.length !== pairs.length * 2 || new Set(used).size !== used.length || used.some(id => !ids.has(id)) || q.correctOptionIds.length || q.acceptedAnswers.length) {
      ctx.addIssue({ code: 'custom', message: 'Matching questions need 2-6 pairs covering every option once' });
    }
  } else if (q.type === 'fill' || q.type === 'short') {
    if (q.options.length || q.correctOptionIds.length || !q.acceptedAnswers.length) ctx.addIssue({ code: 'custom', message: 'Text questions require acceptedAnswers and no options' });
  } else if (q.options.length < 2 || !q.correctOptionIds.length || q.acceptedAnswers.length || ((q.type === 'single' || q.type === 'boolean') && correct.size !== 1) || (q.type === 'boolean' && q.options.length !== 2)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid choice question answer key' });
  }
});
export const QuestionListSchema = z.array(QuestionSchema).min(1).max(100).superRefine((questions, ctx) => {
  const ids = new Set<string>();
  for (const q of questions) {
    for (const id of [q.id, ...q.options.map(o => o.id)]) {
      if (ids.has(id)) ctx.addIssue({ code: 'custom', message: 'Question/option IDs must be unique across the quiz' });
      ids.add(id);
    }
  }
});
export type FullQuestionDTO = z.infer<typeof QuestionSchema>;
export type QuestionDraftDTO = FullQuestionDTO;
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export type AnyQuestionType = z.infer<typeof AnyQuestionTypeSchema>;
export type MatchPair = z.infer<typeof MatchPairSchema>;

// Explicit allowlist: never derive this from a full question with object spread.
export const StudentAttemptQuestionSchema = z.strictObject({
  id: IdSchema, type: AnyQuestionTypeSchema, stem: z.string(), points: z.number(), options: z.array(OptionSchema),
  // matching: transient ids of the left column (original order); the rest are right-column choices
  matchLeft: z.array(IdSchema).optional(),
  audioUrl: z.string().max(200).optional(),
});
export type StudentAttemptQuestionDTO = z.infer<typeof StudentAttemptQuestionSchema>;
export const QuizGenerateSchema = z.strictObject({
  documentId: IdSchema,
  mode: z.enum(['extract_existing', 'ai_generate', 'source_only', 'ai_analyze']),
  questionCount: z.number().int().min(1).max(100),
  types: z.array(QuestionTypeSchema).min(1).max(5).refine(v => new Set(v).size === v.length),
  difficultyDistribution: z.strictObject({ recognition: z.number().min(0).max(100), comprehension: z.number().min(0).max(100), application: z.number().min(0).max(100) })
    .refine(v => Math.abs(v.recognition + v.comprehension + v.application - 100) < 0.001, 'Distribution must total 100').optional(),
  // Exact blueprint (ai_generate): how many questions of each type at each cognitive level.
  matrix: z.array(z.strictObject({ type: QuestionTypeSchema, difficulty: DifficultySchema, count: z.number().int().min(0).max(100) })).max(15).optional(),
}).superRefine((v, ctx) => {
  if (!v.matrix) return;
  const total = v.matrix.reduce((sum, cell) => sum + cell.count, 0);
  if (total !== v.questionCount || v.matrix.some(cell => cell.count > 0 && !v.types.includes(cell.type))) ctx.addIssue({ code: 'custom', message: 'Matrix must use the selected types and total questionCount' });
});
export const QuizCreateSchema = z.strictObject({
  documentId: IdSchema, title: z.string().trim().min(1).max(200), description: z.string().max(4000).default(''), questions: QuestionListSchema,
});
export const QuizPatchSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(), description: z.string().max(4000).optional(), questions: QuestionListSchema.optional(),
}).refine(v => Object.keys(v).length > 0);
export const QuizPublishSchema = z.strictObject({
  durationMinutes: z.number().int().min(1).max(1440).optional(), deadline: z.iso.datetime().optional(), allowReview: z.boolean(),
});
export const QuizSnapshotSchema = z.strictObject({
  title: z.string(), description: z.string(), durationMinutes: z.number().int().positive(),
  deadline: z.iso.datetime().nullable(), allowReview: z.boolean(), questions: QuestionListSchema,
});
export type QuizSnapshot = z.infer<typeof QuizSnapshotSchema>;
export const QuizSummarySchema = z.strictObject({ id: IdSchema, title: z.string(), description: z.string().optional(), isPublished: z.boolean(), durationMinutes: z.number(), allowReview: z.boolean().optional(), deadline: z.string().nullable().optional(), shareCode: z.string().nullable().optional(), createdAt: z.iso.datetime() });
export const QuizDetailSchema = QuizSummarySchema.extend({ description: z.string(), shareCode: z.string().nullable(), questions: QuestionListSchema });

export const AttemptStartSchema = z.strictObject({ quizId: IdSchema.optional(), shareCode: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(), retry: z.boolean().optional() })
  .refine(v => Boolean(v.quizId || v.shareCode), 'Provide quizId or shareCode');
export const AnswerMapSchema = z.record(IdSchema, z.array(z.string().max(4000)).max(20)).refine(v => Object.keys(v).length <= 100, 'Too many answers');
export const SaveAnswersSchema = z.strictObject({ answers: AnswerMapSchema });
export type AnswerMap = z.infer<typeof AnswerMapSchema>;
export const AttemptStartResponseSchema = z.strictObject({
  attemptId: IdSchema, quizTitle: z.string(), durationMinutes: z.number(), startedAt: z.iso.datetime(), expiresAt: z.iso.datetime(), questions: z.array(StudentAttemptQuestionSchema), isPracticeMode: z.boolean().optional(),
});
export const GradedQuestionSchema = z.strictObject({
  questionId: IdSchema, earnedPoints: z.number(), points: z.number(), correct: z.boolean(),
  correctOptionIds: z.array(IdSchema), acceptedAnswers: z.array(z.string()), explanation: z.string(), sourceRefs: z.array(SourceRefSchema),
  type: AnyQuestionTypeSchema.optional(), difficulty: DifficultySchema.optional(),
  pairs: z.array(MatchPairSchema).optional(),
  // text answer that did not match exactly and has no teacher decision yet
  pendingReview: z.boolean().optional(), feedback: z.string().optional(),
});
export const AttemptGradedResultSchema = z.strictObject({ questions: z.array(GradedQuestionSchema), byTopic: z.record(z.string(), z.object({ earnedPoints: z.number(), totalPoints: z.number() })) });
export type AttemptGradedResultDTO = z.infer<typeof AttemptGradedResultSchema>;
export const ReviewRatingSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type ReviewRating = z.infer<typeof ReviewRatingSchema>;
export const AttemptSubmitResponseSchema = z.strictObject({
  attemptId: IdSchema, submittedAt: z.iso.datetime(), score: z.number(), totalPoints: z.number(), passed: z.boolean(), details: AttemptGradedResultSchema.optional(),
});
export const ApiErrorSchema = z.strictObject({ error: z.strictObject({ code: z.string(), message: z.string() }) });
