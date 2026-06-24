"use client";

import { useEffect, useMemo, useState } from "react";
import BroilerSidebar from "@/components/BroilerSidebar";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type AppNote = {
  id: number;
  module: string;
  page?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  source?: string | null;
  category?: string | null;
  is_done: boolean;
  created_at?: string | null;
  completed_at?: string | null;
};

type AppNoteComment = {
  id: number;
  note_id: number;
  author: string;
  comment: string;
  created_at?: string | null;
};

type DraftNote = {
  title: string;
  description: string;
  page: string;
  priority: string;
  status: string;
  source: string;
  category: string;
};

const emptyDraft: DraftNote = {
  title: "",
  description: "",
  page: "",
  priority: "Medium",
  status: "Todo",
  source: "JJ",
  category: "Feature",
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function BroilerNotesPage() {
  const [notes, setNotes] = useState<AppNote[]>([]);
  const [draft, setDraft] = useState<DraftNote>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("Open");
  const [commentsByNote, setCommentsByNote] = useState<
    Record<number, AppNoteComment[]>
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});

  async function loadNotes() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/notes?module=broilers`);

      if (!response.ok) {
        throw new Error(`Could not load notes: ${response.status}`);
      }

			const data: AppNote[] = await response.json();
			setNotes(data);

			const defaultOpenComments: Record<number, boolean> = {};

			for (const note of data) {
				defaultOpenComments[note.id] = true;
			}

			setOpenComments(defaultOpenComments);

			for (const note of data) {
				loadComments(note.id);
			}
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not load notes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  const filteredNotes = useMemo(() => {
    if (filter === "Done") return notes.filter((note) => note.is_done);
    if (filter === "All") return notes;
    return notes.filter((note) => !note.is_done);
  }, [notes, filter]);

  const counts = useMemo(() => {
    return {
      total: notes.length,
      open: notes.filter((note) => !note.is_done).length,
      done: notes.filter((note) => note.is_done).length,
      high: notes.filter(
        (note) => !note.is_done && ["High", "Critical"].includes(note.priority),
      ).length,
    };
  }, [notes]);

  function updateDraft(field: keyof DraftNote, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function addNote() {
    if (!draft.title.trim()) {
      setMessage("Add a title first.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      module: "broilers",
      page: draft.page || null,
      title: draft.title.trim(),
      description: draft.description || null,
      priority: draft.priority,
      status: draft.status,
      source: draft.source || null,
      category: draft.category,
      is_done: false,
    };

    try {
      const response = await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Could not save note: ${response.status}`);
      }

      const saved: AppNote = await response.json();

      setNotes((current) => [saved, ...current]);
      setDraft(emptyDraft);
      setMessage("Note added.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setSaving(false);
    }
  }

  async function updateNote(noteId: number, payload: Partial<AppNote>) {
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      const saved: AppNote = await response.json();

      setNotes((current) =>
        current.map((note) => (note.id === noteId ? saved : note)),
      );
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not update note.");
    }
  }

  async function deleteNote(noteId: number) {
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      setNotes((current) => current.filter((note) => note.id !== noteId));
      setMessage("Note deleted.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not delete note.");
    }
  }

  async function loadComments(noteId: number) {
    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}/comments`);

      if (!response.ok) {
        throw new Error(`Could not load comments: ${response.status}`);
      }

      const data: AppNoteComment[] = await response.json();

      setCommentsByNote((current) => ({
        ...current,
        [noteId]: data,
      }));
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not load comments.");
    }
  }

  async function toggleComments(noteId: number) {
    const nextOpen = !openComments[noteId];

    setOpenComments((current) => ({
      ...current,
      [noteId]: nextOpen,
    }));

    if (nextOpen && !commentsByNote[noteId]) {
      await loadComments(noteId);
    }
  }

  function updateCommentDraft(noteId: number, value: string) {
    setCommentDrafts((current) => ({
      ...current,
      [noteId]: value,
    }));
  }

  async function addComment(noteId: number) {
    const commentText = (commentDrafts[noteId] || "").trim();

    if (!commentText) {
      setMessage("Add a comment first.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note_id: noteId,
          author: "JJ",
          comment: commentText,
        }),
      });

      if (!response.ok) {
        throw new Error(`Could not save comment: ${response.status}`);
      }

      const saved: AppNoteComment = await response.json();

      setCommentsByNote((current) => ({
        ...current,
        [noteId]: [...(current[noteId] || []), saved],
      }));

      setCommentDrafts((current) => ({
        ...current,
        [noteId]: "",
      }));

      setMessage("Comment added.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not save comment.");
    }
  }

  return (
    <div className="page-shell">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="topbar">
          <div>
            <p className="eyebrow">OviCore Build Notes</p>
            <h2>Dev Notes</h2>
            <p>
              Capture build tasks, feature ideas, terminology notes, bugs,
              review items, and release follow-ups.
            </p>
          </div>

          <button className="primary-button" type="button" onClick={loadNotes}>
            Refresh
          </button>
        </section>

        <section className="kpi-grid">
          <div className="kpi-card">
            <span>Open Notes</span>
            <strong>{counts.open}</strong>
            <p>Still to review or build.</p>
          </div>

          <div className="kpi-card">
            <span>High Priority</span>
            <strong>{counts.high}</strong>
            <p>High or critical open notes.</p>
          </div>

          <div className="kpi-card">
            <span>Completed</span>
            <strong>{counts.done}</strong>
            <p>Marked as done.</p>
          </div>

          <div className="kpi-card">
            <span>Total Notes</span>
            <strong>{counts.total}</strong>
            <p>All Broiler build notes.</p>
          </div>

          <div className="kpi-card">
            <span>Module</span>
            <strong>Broilers</strong>
            <p>Filtered to Broiler notes.</p>
          </div>
        </section>

        <section className="notes-layout">
          <div className="notes-entry-card">
            <div className="notes-card-head">
              <div>
                <p className="eyebrow">Quick Add</p>
                <h3>Add Dev Note</h3>
              </div>
            </div>

            <div className="notes-form-grid">
              <label>
                Title
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="Example: Add cull reasons to Performance page"
                />
              </label>

              <label>
                Page / Area
                <input
                  value={draft.page}
                  onChange={(event) => updateDraft("page", event.target.value)}
                  placeholder="Performance, Processing, Home..."
                />
              </label>

              <label>
                Priority
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    updateDraft("priority", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </label>

              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value)}
                >
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>Blocked</option>
                  <option>Done</option>
                </select>
              </label>

              <label>
                Source
                <select
                  value={draft.source}
                  onChange={(event) => updateDraft("source", event.target.value)}
                >
                  <option>JJ</option>
                  <option>Adam</option>
                  <option>Industry Review</option>
                  <option>User Feedback</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Category
                <select
                  value={draft.category}
                  onChange={(event) =>
                    updateDraft("category", event.target.value)
                  }
                >
                  <option>Feature</option>
                  <option>Bug</option>
                  <option>Terminology</option>
                  <option>Review</option>
                  <option>UX</option>
                  <option>Data</option>
                  <option>Release</option>
                </select>
              </label>

              <label className="notes-description">
                Details
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    updateDraft("description", event.target.value)
                  }
                  placeholder="Add details, wording, poultry lingo, data rules, or what needs to change..."
                />
              </label>
            </div>

            <button
              type="button"
              className="primary-button notes-add-button"
              onClick={addNote}
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Note"}
            </button>

            {message && <p className="notes-message">{message}</p>}
          </div>

          <div className="notes-list-card">
            <div className="notes-card-head">
              <div>
                <p className="eyebrow">Checklist</p>
                <h3>Build Notes</h3>
              </div>

              <div className="notes-filter">
                {["Open", "All", "Done"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={filter === item ? "active" : ""}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="notes-list">
              {loading ? (
                <div className="note-empty">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="note-empty">
                  No dev notes yet. Add the first build note.
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div key={note.id}>
                    <div
                      className={note.is_done ? "note-item note-done" : "note-item"}
                    >
                      <button
                        type="button"
                        className={
                          note.is_done ? "todo-radio checked" : "todo-radio"
                        }
                        onClick={() =>
                          updateNote(note.id, {
                            is_done: !note.is_done,
                            status: !note.is_done ? "Done" : "Todo",
                          })
                        }
                        aria-label="Toggle note complete"
                      >
                        {note.is_done ? "✓" : ""}
                      </button>

                      <div className="note-content">
                        <div className="note-title-row">
                          <strong>{note.title}</strong>

                          <div className="note-pills">
                            <span
                              className={`priority-${note.priority.toLowerCase()}`}
                            >
                              {note.priority}
                            </span>
                            <span>{note.status}</span>
                            {note.source && <span>{note.source}</span>}
                          </div>
                        </div>

                        {note.description && <p>{note.description}</p>}

                        <div className="note-meta">
                          <span>{note.category || "Feature"}</span>
                          {note.page && <span>{note.page}</span>}
                          {note.created_at && (
                            <span>Created {formatDate(note.created_at)}</span>
                          )}
                        </div>
                      </div>

                      <div className="note-actions">
                        <button
                          type="button"
                          className="note-comment-button"
                          onClick={() => toggleComments(note.id)}
                        >
                          Comments
                        </button>

                        <button
                          type="button"
                          className="note-delete-button"
                          onClick={() => deleteNote(note.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {openComments[note.id] && (
                      <div className="note-comments-panel">
                        <div className="note-comments-list">
                          {(commentsByNote[note.id] || []).length === 0 ? (
                            <p className="note-comment-empty">No comments yet.</p>
                          ) : (
                            commentsByNote[note.id].map((comment) => (
                              <div className="note-comment" key={comment.id}>
                                <strong>{comment.author}</strong>
                                <p>{comment.comment}</p>
                                {comment.created_at && (
                                  <span>{formatDate(comment.created_at)}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="note-comment-entry">
                          <textarea
                            value={commentDrafts[note.id] || ""}
                            onChange={(event) =>
                              updateCommentDraft(note.id, event.target.value)
                            }
                            placeholder="Add an opinion, review note, terminology suggestion, or build comment..."
                          />

                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => addComment(note.id)}
                          >
                            Add Comment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}