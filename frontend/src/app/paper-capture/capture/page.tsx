"use client";

import {
  Suspense,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";

import BroilerSidebar from "@/components/BroilerSidebar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE = "";

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    const nextPath =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?next=${encodeURIComponent(nextPath)}`;

    throw new Error("Your login session has expired.");
  }

  return response;
}

type CaptureSource = {
  template_id: string;
  opening_birds_am?: number | null;
  opening_birds_pm?: number | null;

  mortality_front_am?: number | null;
  mortality_front_pm?: number | null;
  mortality_middle_am?: number | null;
  mortality_middle_pm?: number | null;
  mortality_back_am?: number | null;
  mortality_back_pm?: number | null;
  mortality_other_am?: number | null;
  mortality_other_pm?: number | null;

  cull_legs_am?: number | null;
  cull_legs_pm?: number | null;
  cull_runts_am?: number | null;
  cull_runts_pm?: number | null;
  cull_beak_am?: number | null;
  cull_beak_pm?: number | null;
  cull_other_am?: number | null;
  cull_other_pm?: number | null;

  feed_kg_am?: number | null;
  feed_kg_pm?: number | null;
  water_litres_am?: number | null;
  water_litres_pm?: number | null;
  body_weight_kg_am?: number | null;
  body_weight_kg_pm?: number | null;

  observations?: string | null;
  actions_taken?: string | null;
  confidence: Record<string, number>;
};

type CaptureReview = {
  opening_birds: number | null;

  mortality_front: number;
  mortality_middle: number;
  mortality_back: number;
  mortality_other: number;

  cull_legs: number;
  cull_runts: number;
  cull_beak: number;
  cull_other: number;

  feed_kg: number | null;
  water_litres: number | null;
  body_weight_kg: number | null;
  notes: string | null;
};

type CaptureResult = {
  id: number;
  company_id: number;
  placement_plan_id: number;
  template_id: string;
  entry_date: string;
  farm_name?: string | null;
  shed_name?: string | null;
  cycle_code?: string | null;
  age_days?: number | null;
  status: string;
  overall_confidence?: number | null;
  source: CaptureSource;
  proposed: CaptureReview;
  warnings: string[];
};

type PerformanceSaveResult = {
  capture_id: number;
  status: string;
  performance_entry: {
    id: number;
    placement_plan_id: number;
    entry_date: string;
    mortality_birds?: number | null;
    cull_birds?: number | null;
    closing_birds?: number | null;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function pct(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function confidenceTone(value?: number | null) {
  if (value === null || value === undefined) return "unknown";
  if (value >= 0.9) return "good";
  if (value >= 0.8) return "medium";
  return "low";
}

function sourceValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function PaperCaptureReviewPageContent() {
  const searchParams = useSearchParams();
  const {
    currentUser,
    loadingUser,
    userError,
  } = useCurrentUser();

  const activeCompanyId = useMemo(() => {
    const companyParam = searchParams.get("company_id");
    const parsedCompanyId = Number(companyParam);

    if (currentUser?.is_global_admin) {
      if (
        Number.isInteger(parsedCompanyId) &&
        parsedCompanyId > 0
      ) {
        return parsedCompanyId;
      }

      if (typeof window !== "undefined") {
        const rememberedCompanyId = Number(
          window.localStorage.getItem(
            "ovicore_selected_company_id",
          ),
        );

        if (
          Number.isInteger(rememberedCompanyId) &&
          rememberedCompanyId > 0
        ) {
          return rememberedCompanyId;
        }
      }

      return null;
    }

    return currentUser?.company_id ?? null;
  }, [
    currentUser?.company_id,
    currentUser?.is_global_admin,
    searchParams,
  ]);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [review, setReview] = useState<CaptureReview | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<PerformanceSaveResult | null>(null);

  function chooseFile(nextFile: File | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setCapture(null);
    setReview(null);
    setSaved(null);
    setMessage("");

    if (nextFile) {
      setPreviewUrl(URL.createObjectURL(nextFile));
    } else {
      setPreviewUrl("");
    }
  }

  async function analyseSheet() {
    if (!file || !activeCompanyId) return;

    setAnalysing(true);
    setMessage("");
    setCapture(null);
    setReview(null);
    setSaved(null);

    try {
      const formData = new FormData();
      formData.set("company_id", String(activeCompanyId));
      formData.set("image", file);

      const response = await authenticatedFetch(
        `${API_BASE}/api/paper-capture/broilers/extract`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not analyse sheet (${response.status}). ${errorText}`,
        );
      }

      const data: CaptureResult = await response.json();

      setCapture(data);
      setReview(data.proposed);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not analyse the completed sheet.",
      );
    } finally {
      setAnalysing(false);
    }
  }

  function updateReview(
    field: keyof CaptureReview,
    value: string,
  ) {
    setReview((current) => {
      if (!current) return current;

      if (field === "notes") {
        return {
          ...current,
          notes: value,
        };
      }

      const nullableFields: Array<keyof CaptureReview> = [
        "opening_birds",
        "feed_kg",
        "water_litres",
        "body_weight_kg",
      ];

      return {
        ...current,
        [field]:
          value === "" && nullableFields.includes(field)
            ? null
            : Number(value || 0),
      };
    });
  }

  async function approveAndSave() {
    if (!capture || !review) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/paper-capture/broilers/${capture.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewed: review,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Could not save Paper Capture (${response.status}). ${errorText}`,
        );
      }

      const data: PerformanceSaveResult =
        await response.json();

      setSaved(data);
      setMessage(
        "Approved paper data has been saved to Broiler Daily Data Entry.",
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save the reviewed data.",
      );
    } finally {
      setSaving(false);
    }
  }

  const sourceRows = capture
    ? [
        ["Opening Birds", "opening_birds_am", "opening_birds_pm"],
        ["Mortality – Front", "mortality_front_am", "mortality_front_pm"],
        ["Mortality – Middle", "mortality_middle_am", "mortality_middle_pm"],
        ["Mortality – Back", "mortality_back_am", "mortality_back_pm"],
        ["Mortality – Other", "mortality_other_am", "mortality_other_pm"],
        ["Culls – Legs", "cull_legs_am", "cull_legs_pm"],
        ["Culls – Runts", "cull_runts_am", "cull_runts_pm"],
        ["Culls – Beak", "cull_beak_am", "cull_beak_pm"],
        ["Culls – Other", "cull_other_am", "cull_other_pm"],
        ["Feed kg", "feed_kg_am", "feed_kg_pm"],
        ["Water L", "water_litres_am", "water_litres_pm"],
        ["Bodyweight kg", "body_weight_kg_am", "body_weight_kg_pm"],
      ] as const
    : [];

  return (
    <div className="page-shell paper-review-page">
      <BroilerSidebar />

      <main className="main-panel">
        <section className="capture-header">
          <div>
            <p className="capture-eyebrow">OviCore Paper Capture</p>
            <h1>Capture Completed Sheet</h1>
            <p>
              Photograph the completed Broiler Daily Sheet. OviCore reads the
              handwritten AM / PM values, then you review them before anything
              is saved.
            </p>
          </div>

          <Link
            href="/paper-capture"
            className="capture-back"
          >
            Print Daily Sheets
          </Link>
        </section>

        {userError || message ? (
          <div
            className={`capture-message ${
              saved ? "success" : ""
            }`}
          >
            {saved ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertTriangle size={18} aria-hidden="true" />
            )}
            <span>{userError || message}</span>
          </div>
        ) : null}

        <section className="capture-grid">
          <article className="capture-card upload-card">
            <div className="capture-card-head">
              <div>
                <span className="capture-step">1</span>
                <div>
                  <h2>Completed sheet</h2>
                  <p>Take a clear photo of the entire A4 page.</p>
                </div>
              </div>
            </div>

            <label className="capture-dropzone">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected completed Broiler Daily Sheet"
                />
              ) : (
                <>
                  <Camera size={34} aria-hidden="true" />
                  <strong>Take photo or choose image</strong>
                  <span>JPG, PNG or WEBP · maximum 12 MB</span>
                </>
              )}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) =>
                  chooseFile(
                    event.target.files?.[0] ?? null,
                  )
                }
              />
            </label>

            <div className="capture-upload-actions">
              {file ? (
                <button
                  type="button"
                  className="capture-secondary"
                  onClick={() => chooseFile(null)}
                  disabled={analysing}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Choose another
                </button>
              ) : null}

              <button
                type="button"
                className="capture-primary"
                disabled={
                  !file ||
                  !activeCompanyId ||
                  analysing ||
                  loadingUser
                }
                onClick={() => void analyseSheet()}
              >
                {analysing ? (
                  <Loader2
                    size={17}
                    className="capture-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload size={17} aria-hidden="true" />
                )}
                {analysing
                  ? "Reading handwriting…"
                  : "Analyse Sheet"}
              </button>
            </div>

            {!activeCompanyId && !loadingUser ? (
              <p className="capture-company-warning">
                Select a working company before analysing a sheet.
              </p>
            ) : null}
          </article>

          <article className="capture-card detected-card">
            <div className="capture-card-head">
              <div>
                <span className="capture-step">2</span>
                <div>
                  <h2>Detected sheet</h2>
                  <p>OviCore verifies the template against the cycle.</p>
                </div>
              </div>
            </div>

            {!capture ? (
              <div className="capture-empty">
                <FileImage size={28} aria-hidden="true" />
                <span>Sheet details appear after analysis.</span>
              </div>
            ) : (
              <>
                <div className="capture-detected-grid">
                  <div>
                    <span>Farm</span>
                    <strong>{capture.farm_name || "—"}</strong>
                  </div>
                  <div>
                    <span>Shed</span>
                    <strong>{capture.shed_name || "—"}</strong>
                  </div>
                  <div>
                    <span>Flock / Batch</span>
                    <strong>{capture.cycle_code || "—"}</strong>
                  </div>
                  <div>
                    <span>Date</span>
                    <strong>{formatDate(capture.entry_date)}</strong>
                  </div>
                  <div>
                    <span>Age</span>
                    <strong>
                      {capture.age_days === null ||
                      capture.age_days === undefined
                        ? "—"
                        : `${capture.age_days} days`}
                    </strong>
                  </div>
                  <div>
                    <span>Template</span>
                    <strong>{capture.template_id}</strong>
                  </div>
                </div>

                <div className="capture-confidence">
                  <span>Overall AI confidence</span>
                  <strong
                    data-tone={confidenceTone(
                      capture.overall_confidence,
                    )}
                  >
                    {pct(capture.overall_confidence)}
                  </strong>
                </div>

                {capture.warnings.length > 0 ? (
                  <div className="capture-warning-list">
                    {capture.warnings.map((warning) => (
                      <p key={warning}>
                        <AlertTriangle
                          size={14}
                          aria-hidden="true"
                        />
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </article>
        </section>

        {capture && review ? (
          <>
            <section className="capture-card source-card">
              <div className="capture-card-head">
                <div>
                  <span className="capture-step">3</span>
                  <div>
                    <h2>What OviCore read</h2>
                    <p>
                      AM / PM values are shown exactly as read from the
                      handwritten sheet. Low-confidence cells are highlighted.
                    </p>
                  </div>
                </div>
              </div>

              <div className="source-table-wrap">
                <table className="source-table">
                  <thead>
                    <tr>
                      <th>Paper field</th>
                      <th>AM</th>
                      <th>Confidence</th>
                      <th>PM</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map(
                      ([label, amField, pmField]) => {
                        const amConfidence =
                          capture.source.confidence[amField];
                        const pmConfidence =
                          capture.source.confidence[pmField];

                        return (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>
                              {sourceValue(
                                capture.source[amField],
                              )}
                            </td>
                            <td>
                              <span
                                className="confidence-pill"
                                data-tone={confidenceTone(
                                  amConfidence,
                                )}
                              >
                                {pct(amConfidence)}
                              </span>
                            </td>
                            <td>
                              {sourceValue(
                                capture.source[pmField],
                              )}
                            </td>
                            <td>
                              <span
                                className="confidence-pill"
                                data-tone={confidenceTone(
                                  pmConfidence,
                                )}
                              >
                                {pct(pmConfidence)}
                              </span>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="capture-notes-read">
                <div>
                  <span>Observations / Issues</span>
                  <p>
                    {capture.source.observations ||
                      "No handwriting detected."}
                  </p>
                </div>
                <div>
                  <span>Actions Taken</span>
                  <p>
                    {capture.source.actions_taken ||
                      "No handwriting detected."}
                  </p>
                </div>
              </div>
            </section>

            <section className="capture-card review-card">
              <div className="capture-card-head">
                <div>
                  <span className="capture-step">4</span>
                  <div>
                    <h2>Review before saving</h2>
                    <p>
                      These are the final Daily Data Entry values. Mortality,
                      culls, feed and water are AM + PM. Bodyweight uses PM when
                      present, otherwise AM.
                    </p>
                  </div>
                </div>
              </div>

              <div className="review-grid">
                <ReviewInput
                  label="Opening Birds"
                  value={review.opening_birds}
                  onChange={(value) =>
                    updateReview("opening_birds", value)
                  }
                />

                <ReviewInput
                  label="Mortality – Front"
                  value={review.mortality_front}
                  onChange={(value) =>
                    updateReview("mortality_front", value)
                  }
                />

                <ReviewInput
                  label="Mortality – Middle"
                  value={review.mortality_middle}
                  onChange={(value) =>
                    updateReview("mortality_middle", value)
                  }
                />

                <ReviewInput
                  label="Mortality – Back"
                  value={review.mortality_back}
                  onChange={(value) =>
                    updateReview("mortality_back", value)
                  }
                />

                <ReviewInput
                  label="Mortality – Other"
                  value={review.mortality_other}
                  onChange={(value) =>
                    updateReview("mortality_other", value)
                  }
                />

                <ReviewInput
                  label="Culls – Legs"
                  value={review.cull_legs}
                  onChange={(value) =>
                    updateReview("cull_legs", value)
                  }
                />

                <ReviewInput
                  label="Culls – Runts"
                  value={review.cull_runts}
                  onChange={(value) =>
                    updateReview("cull_runts", value)
                  }
                />

                <ReviewInput
                  label="Culls – Beak"
                  value={review.cull_beak}
                  onChange={(value) =>
                    updateReview("cull_beak", value)
                  }
                />

                <ReviewInput
                  label="Culls – Other"
                  value={review.cull_other}
                  onChange={(value) =>
                    updateReview("cull_other", value)
                  }
                />

                <ReviewInput
                  label="Feed kg"
                  value={review.feed_kg}
                  step="0.01"
                  onChange={(value) =>
                    updateReview("feed_kg", value)
                  }
                />

                <ReviewInput
                  label="Water L"
                  value={review.water_litres}
                  step="0.01"
                  onChange={(value) =>
                    updateReview("water_litres", value)
                  }
                />

                <ReviewInput
                  label="Bodyweight kg"
                  value={review.body_weight_kg}
                  step="0.001"
                  onChange={(value) =>
                    updateReview("body_weight_kg", value)
                  }
                />

                <label className="review-notes">
                  <span>Notes</span>
                  <textarea
                    value={review.notes ?? ""}
                    onChange={(event) =>
                      updateReview(
                        "notes",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="capture-save-bar">
                <div>
                  <strong>
                    Nothing is written to Daily Data Entry until you approve.
                  </strong>
                  <span>
                    Existing records for the same flock/date are protected from
                    being overwritten.
                  </span>
                </div>

                <button
                  type="button"
                  className="capture-save"
                  disabled={saving || Boolean(saved)}
                  onClick={() => void approveAndSave()}
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="capture-spinner"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save size={17} aria-hidden="true" />
                  )}
                  {saved
                    ? "Saved to Daily Data Entry"
                    : saving
                      ? "Saving…"
                      : "Approve & Save"}
                </button>
              </div>
            </section>
          </>
        ) : null}

        <style jsx global>{`
          .paper-review-page .main-panel {
            min-width: 0;
          }

          .capture-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 18px 20px;
            margin-bottom: 12px;
            border-radius: 16px;
            color: white;
            background:
              radial-gradient(circle at 92% 12%, rgba(45, 212, 191, 0.22), transparent 28%),
              linear-gradient(115deg, #064e3b 0%, #047857 52%, #0f766e 100%);
            box-shadow: 0 10px 28px rgba(6, 78, 59, 0.15);
          }

          .capture-header h1 {
            margin: 0;
            font-size: clamp(24px, 2vw, 34px);
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .capture-header p {
            margin: 7px 0 0;
            max-width: 760px;
            font-size: 13px;
            line-height: 1.4;
            color: rgba(240, 253, 250, 0.88);
          }

          .capture-eyebrow {
            margin: 0 0 4px !important;
            font-size: 10px !important;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .capture-back {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            min-height: 38px;
            padding: 0 12px;
            border: 1px solid rgba(255, 255, 255, 0.24);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            background: rgba(255, 255, 255, 0.10);
            font-size: 11px;
            font-weight: 900;
          }

          .capture-message {
            display: flex;
            align-items: flex-start;
            gap: 9px;
            margin-bottom: 12px;
            padding: 11px 13px;
            border: 1px solid #fed7aa;
            border-radius: 12px;
            background: #fff7ed;
            color: #9a3412;
            font-size: 12px;
            font-weight: 700;
          }

          .capture-message.success {
            border-color: #a7f3d0;
            background: #ecfdf5;
            color: #047857;
          }

          .capture-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
            gap: 12px;
            margin-bottom: 12px;
          }

          .capture-card {
            overflow: hidden;
            border: 1px solid #dce7e3;
            border-radius: 14px;
            background: white;
            box-shadow: 0 8px 24px rgba(15, 78, 66, 0.06);
          }

          .capture-card-head {
            padding: 13px 15px;
            border-bottom: 1px solid #e7efec;
          }

          .capture-card-head > div {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .capture-step {
            flex: 0 0 auto;
            display: grid;
            width: 26px;
            height: 26px;
            place-items: center;
            border-radius: 8px;
            background: #e9f8f2;
            color: #08735a;
            font-size: 11px;
            font-weight: 950;
          }

          .capture-card-head h2 {
            margin: 0;
            color: #173f36;
            font-size: 15px;
          }

          .capture-card-head p {
            margin: 2px 0 0;
            color: #6a827b;
            font-size: 11px;
          }

          .capture-dropzone {
            position: relative;
            min-height: 290px;
            margin: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 7px;
            overflow: hidden;
            border: 1.5px dashed #9fc7ba;
            border-radius: 13px;
            background: #f7fcfa;
            color: #477269;
            cursor: pointer;
          }

          .capture-dropzone img {
            width: 100%;
            height: 360px;
            object-fit: contain;
            background: #eef5f2;
          }

          .capture-dropzone strong {
            color: #17483d;
            font-size: 13px;
          }

          .capture-dropzone span {
            font-size: 10px;
          }

          .capture-dropzone input {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
          }

          .capture-upload-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 0 14px 14px;
          }

          .capture-primary,
          .capture-secondary,
          .capture-save {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 38px;
            padding: 0 13px;
            border-radius: 10px;
            font: inherit;
            font-size: 11px;
            font-weight: 900;
            cursor: pointer;
          }

          .capture-primary,
          .capture-save {
            border: 0;
            background: #08735a;
            color: white;
            box-shadow: 0 7px 16px rgba(8, 115, 90, 0.18);
          }

          .capture-secondary {
            border: 1px solid #cddfd9;
            background: #f8fbfa;
            color: #365f55;
          }

          .capture-primary:disabled,
          .capture-secondary:disabled,
          .capture-save:disabled {
            opacity: 0.48;
            cursor: not-allowed;
            box-shadow: none;
          }

          .capture-spinner {
            animation: capture-spin 900ms linear infinite;
          }

          @keyframes capture-spin {
            to {
              transform: rotate(360deg);
            }
          }

          .capture-company-warning {
            margin: -5px 14px 14px;
            color: #b45309;
            font-size: 10px;
            font-weight: 800;
          }

          .capture-empty {
            min-height: 250px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #789087;
            font-size: 11px;
          }

          .capture-detected-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1px;
            background: #e5eeeb;
          }

          .capture-detected-grid > div {
            min-height: 72px;
            padding: 12px;
            background: white;
          }

          .capture-detected-grid span,
          .capture-confidence span {
            display: block;
            color: #748a84;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.07em;
          }

          .capture-detected-grid strong {
            display: block;
            margin-top: 4px;
            color: #1d4b41;
            font-size: 12px;
          }

          .capture-confidence {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 12px;
            border-top: 1px solid #e7efec;
          }

          .capture-confidence strong {
            padding: 5px 8px;
            border-radius: 8px;
            font-size: 12px;
          }

          [data-tone="good"] {
            background: #ecfdf5;
            color: #047857;
          }

          [data-tone="medium"] {
            background: #fffbeb;
            color: #b45309;
          }

          [data-tone="low"] {
            background: #fff1f2;
            color: #be123c;
          }

          [data-tone="unknown"] {
            background: #f1f5f4;
            color: #64748b;
          }

          .capture-warning-list {
            padding: 0 12px 10px;
          }

          .capture-warning-list p {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            margin: 5px 0;
            padding: 7px 8px;
            border-radius: 8px;
            background: #fff7ed;
            color: #9a4b12;
            font-size: 10px;
            font-weight: 750;
          }

          .source-card,
          .review-card {
            margin-bottom: 12px;
          }

          .source-table-wrap {
            overflow: auto;
          }

          .source-table {
            width: 100%;
            min-width: 700px;
            border-collapse: collapse;
          }

          .source-table th,
          .source-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #edf3f1;
            text-align: left;
            font-size: 11px;
          }

          .source-table th {
            background: #f7faf9;
            color: #59756e;
            font-size: 9px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .source-table td:first-child {
            font-weight: 800;
            color: #284f46;
          }

          .confidence-pill {
            display: inline-flex;
            min-width: 42px;
            justify-content: center;
            padding: 4px 6px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 950;
          }

          .capture-notes-read {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-top: 1px solid #e7efec;
          }

          .capture-notes-read > div {
            padding: 12px;
          }

          .capture-notes-read > div + div {
            border-left: 1px solid #e7efec;
          }

          .capture-notes-read span {
            color: #6d837d;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .capture-notes-read p {
            margin: 5px 0 0;
            color: #284d45;
            font-size: 11px;
            line-height: 1.45;
          }

          .review-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(130px, 1fr));
            gap: 10px;
            padding: 14px;
          }

          .review-field,
          .review-notes {
            display: grid;
            gap: 5px;
          }

          .review-field span,
          .review-notes span {
            color: #57736b;
            font-size: 9px;
            font-weight: 900;
          }

          .review-field input,
          .review-notes textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #cdded8;
            border-radius: 9px;
            background: #fffef5;
            color: #193f36;
            font: inherit;
            font-size: 12px;
            font-weight: 750;
          }

          .review-field input {
            min-height: 38px;
            padding: 0 9px;
          }

          .review-notes {
            grid-column: 1 / -1;
          }

          .review-notes textarea {
            min-height: 78px;
            padding: 9px;
            resize: vertical;
          }

          .capture-save-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            padding: 12px 14px;
            border-top: 1px solid #e7efec;
            background: #f7fbf9;
          }

          .capture-save-bar > div {
            display: grid;
            gap: 2px;
          }

          .capture-save-bar strong {
            color: #234d43;
            font-size: 11px;
          }

          .capture-save-bar span {
            color: #71847f;
            font-size: 9px;
          }

          @media (max-width: 1000px) {
            .capture-grid {
              grid-template-columns: 1fr;
            }

            .review-grid {
              grid-template-columns: repeat(2, minmax(130px, 1fr));
            }
          }

          @media (max-width: 650px) {
            .capture-header,
            .capture-save-bar {
              align-items: stretch;
              flex-direction: column;
            }

            .capture-dropzone {
              min-height: 220px;
            }

            .capture-dropzone img {
              height: 280px;
            }

            .review-grid {
              grid-template-columns: 1fr 1fr;
            }

            .capture-notes-read {
              grid-template-columns: 1fr;
            }

            .capture-notes-read > div + div {
              border-left: 0;
              border-top: 1px solid #e7efec;
            }

            .capture-save {
              width: 100%;
            }
          }
        `}</style>
      </main>
    </div>
  );
}

function ReviewInput({
  label,
  value,
  step = "1",
  onChange,
}: {
  label: string;
  value: number | null;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="review-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

export default function PaperCaptureReviewPage() {
  return (
    <Suspense fallback={null}>
      <PaperCaptureReviewPageContent />
    </Suspense>
  );
}
