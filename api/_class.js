import { list } from './_store.js';

// Everything the dashboard shows, scoped to what `viewer` may see. Three queries in total,
// instead of one per student, so it stays fast as the class grows.
export async function loadClass(viewer) {
  const [userRows, progressRows, feedbackRows, requestRows, resetRows] = await Promise.all([list('user:'), list('progress:'), list('feedback:'), list('reset-request:'), list('progress-reset:')]);
  // "Forgot password" requests this viewer can act on, newest first.
  const resetRequests = requestRows.map(row => row.value).filter(r => r && (viewer.role === 'admin' || (r.role === 'student' && r.lab === viewer.lab)))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const progress = new Map(progressRows.map(row => [row.key.slice('progress:'.length), row.value]));
  const feedback = feedbackRows.map(row => row.value).filter(Boolean)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  const latestFeedback = new Map();
  for (const row of feedback) if (!latestFeedback.has(row.studentId)) latestFeedback.set(row.studentId, row);
  const accounts = userRows.filter(row => !row.key.startsWith('user:email:')).map(row => row.value).filter(Boolean);
  const users = accounts
    .filter(value => value.role === 'student' && (viewer.role === 'admin' || value.lab === viewer.lab))
    .map(value => ({
      id: value.id, name: value.name, email: value.email, role: value.role, lab: value.lab, createdAt: value.createdAt,
      progress: progress.get(value.id) || {},
      feedbackAt: latestFeedback.get(value.id)?.submittedAt || null
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  // Progress resets, newest first, so staff can see who was reset, by whom, and what they had.
  const progressResets = resetRows.map(row => row.value).filter(r => r && (viewer.role === 'admin' || r.lab === viewer.lab))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  // `lab` lets a mentor's open dashboard notice when the admin moves them to another lab.
  if (viewer.role !== 'admin') return { users, resetRequests, progressResets, lab: viewer.lab };
  const mentors = accounts.filter(value => value.role === 'mentor')
    .map(value => ({ id: value.id, name: value.name, email: value.email, lab: value.lab, createdAt: value.createdAt }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { users, mentors, feedback, resetRequests, progressResets };
}
