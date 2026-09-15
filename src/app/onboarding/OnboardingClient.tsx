"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Program {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface Props {
  userEmail: string;
  programs: Program[];
  isGuest?: boolean;
}

interface SemesterValue {
  term: "Fall" | "Spring" | "Summer";
  year: number;
}

function toSemesterString(s: SemesterValue) {
  return `${s.term} ${s.year}`;
}

const TERMS = ["Fall", "Spring", "Summer"] as const;
const CUR_YEAR = new Date().getFullYear();

function SemesterPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SemesterValue;
  onChange: (v: SemesterValue) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2">
        {/* Term selector */}
        <div className="flex rounded-lg border border-card-border overflow-hidden shrink-0">
          {TERMS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...value, term: t })}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                value.term === t
                  ? "bg-accent text-white"
                  : "bg-background text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Year input */}
        <input
          type="number"
          min={2015}
          max={2040}
          value={value.year}
          onChange={(e) => {
            const y = parseInt(e.target.value, 10);
            if (!isNaN(y)) onChange({ ...value, year: y });
          }}
          className="w-24 px-3 py-2 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
    </div>
  );
}

function SearchablePrograms({
  programs,
  selected,
  onToggle,
  placeholder,
}: {
  programs: Program[];
  selected: number[];
  onToggle: (id: number) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? programs.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      )
    : programs;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted px-3 py-2 italic">No results for &quot;{query}&quot;</p>
        )}
        {filtered.map((p) => {
          const checked = selected.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? "border-accent bg-accent-light/40"
                  : "border-card-border hover:bg-card-border/20"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(p.id)}
                className="accent-accent"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted capitalize">{p.type.replace("-", " ")}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const STEP_LABELS = ["Welcome", "Timeline", "Major(s)", "Minors", "Review"];

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= step ? "bg-accent" : "bg-card-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingClient({ userEmail, programs, isGuest = false }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(userEmail ? userEmail.split("@")[0] : "");
  const [startSem, setStartSem] = useState<SemesterValue>({ term: "Fall", year: CUR_YEAR - 1 });
  const [endSem, setEndSem] = useState<SemesterValue>({ term: "Spring", year: CUR_YEAR + 3 });
  const [selectedPrograms, setSelectedPrograms] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // majors = major + joint-major; minors = minor
  const majors = programs.filter((p) => p.type === "major" || p.type === "joint-major");
  const minors = programs.filter((p) => p.type === "minor");

  function toggleProgram(id: number) {
    setSelectedPrograms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function next() {
    setError("");
    if (step === 2) {
      const hasMajor = selectedPrograms.some((id) => majors.find((m) => m.id === id));
      if (!hasMajor) { setError("Please select at least one major."); return; }
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          startSemester: toSemesterString(startSem),
          endSemester: toSemesterString(endSem),
          programIds: selectedPrograms,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  const selectedAll = selectedPrograms
    .map((id) => programs.find((p) => p.id === id))
    .filter(Boolean) as Program[];

  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent text-white mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">University Tracker</h1>
        <p className="text-sm text-muted mt-1">Let&apos;s set up your academic profile — takes about a minute.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <StepIndicator step={step} total={STEP_LABELS.length} />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Welcome to University Tracker</h2>
              <p className="text-sm text-muted mt-1">
                {isGuest
                  ? "No account needed — you can create one later to sync across devices."
                  : <>Signed in as <span className="font-medium text-foreground">{userEmail}</span>.</>
                }
                {" "}This app helps you stay on top of your BU degree from day one.
              </p>
            </div>
            {/* Feature bullets */}
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: "📊", text: "Track credits, GPA, and BU Hub units at a glance" },
                { icon: "🎓", text: "See exactly which courses satisfy your major requirements" },
                { icon: "📅", text: "Plan semesters and check for schedule conflicts" },
                { icon: "⭐", text: "Read real RateMyProfessors reviews before you enroll" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3 bg-card-border/20 rounded-lg px-3 py-2.5">
                  <span className="text-base shrink-0">{icon}</span>
                  <p className="text-sm text-foreground">{text}</p>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">What should we call you?</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>
        )}

        {/* Step 1: Timeline */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Your Timeline</h2>
              <p className="text-sm text-muted mt-1">
                Used to calculate how many semesters you have left and pace your degree plan.
              </p>
            </div>
            <SemesterPicker
              label="First semester at BU"
              value={startSem}
              onChange={setStartSem}
            />
            <SemesterPicker
              label="Expected graduation"
              value={endSem}
              onChange={setEndSem}
            />
            <p className="text-xs text-muted bg-card-border/20 rounded-lg px-3 py-2">
              You can update your timeline any time from the Settings page.
            </p>
          </div>
        )}

        {/* Step 2: Major(s) */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Your Major(s)</h2>
              <p className="text-sm text-muted mt-1">
                Select one or more — including a double major. You can change this later.
              </p>
            </div>
            <SearchablePrograms
              programs={majors}
              selected={selectedPrograms}
              onToggle={toggleProgram}
              placeholder="Search majors…"
            />
            {selectedPrograms.some((id) => majors.find((m) => m.id === id)) && (
              <p className="text-xs text-success">
                {selectedPrograms.filter((id) => majors.find((m) => m.id === id)).length} major(s) selected
              </p>
            )}
          </div>
        )}

        {/* Step 3: Minors */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Minors</h2>
              <p className="text-sm text-muted mt-1">
                Optionally add any minors. You can skip this and add them later.
              </p>
            </div>
            {minors.length > 0 ? (
              <SearchablePrograms
                programs={minors}
                selected={selectedPrograms}
                onToggle={toggleProgram}
                placeholder="Search minors…"
              />
            ) : (
              <p className="text-sm text-muted italic">No minors found in the database.</p>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Review &amp; Confirm</h2>
              <p className="text-sm text-muted mt-1">
                Everything looks good? You can update this any time.
              </p>
            </div>
            <div className="space-y-3 text-sm divide-y divide-card-border">
              <div className="flex justify-between py-2">
                <span className="text-muted">Name</span>
                <span className="font-medium">{displayName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted">Started</span>
                <span className="font-medium">{toSemesterString(startSem)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted">Graduation</span>
                <span className="font-medium">{toSemesterString(endSem)}</span>
              </div>
              <div className="py-2">
                <span className="text-muted">Programs</span>
                {selectedAll.length === 0 ? (
                  <span className="ml-2 text-muted italic">none</span>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {selectedAll.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          p.type === "minor" ? "bg-info-light text-info" : "bg-accent-light text-accent"
                        }`}>
                          {p.type === "minor" ? "minor" : "major"}
                        </span>
                        <span>{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-accent bg-accent-light rounded px-3 py-2">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => { setError(""); setStep((s) => s - 1); }}
              className="flex-1 py-2 border border-card-border rounded-lg text-sm font-medium hover:bg-card-border/30 transition-colors"
            >
              Back
            </button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={next}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? "Saving..." : "Get started"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
