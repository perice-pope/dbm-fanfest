"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitResponse } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";

type Q = { q: string; options: string[] };

export function ResponseForm({ slug, questId, type, questions }: { slug: string; questId: string; type: string; questions: Q[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [result, setResult] = useState<{ score: number; total: number; correct: number[] | null; xp: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  const complete = answers.every((a) => a != null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await submitResponse(slug, questId, answers);
      if (!r.ok) return setError(r.error);
      setResult({ score: r.data.score, total: r.data.total, correct: r.data.correct, xp: r.data.xp });
      if (r.data.awarded) push(`+${r.data.xp.toLocaleString()} XP`, "xp");
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="card p-5">
        {type === "quiz" ? (
          <>
            <p className="display text-3xl">{result.score} of {result.total} right</p>
            <p className="mt-1 text-sm text-muted">{result.xp > 0 ? `+${result.xp.toLocaleString()} XP.` : "No XP this time."} {result.score === result.total ? "Perfect." : "The right answers are marked below."}</p>
            <ol className="mt-4 space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{q.q}</p>
                  <ul className="mt-1 space-y-1">
                    {q.options.map((o, j) => {
                      const isCorrect = result.correct?.[i] === j;
                      const mine = answers[i] === j;
                      return <li key={j} className={`rounded px-2 py-1 ${isCorrect ? "bg-success/15 text-success" : mine ? "bg-danger/15 text-danger" : "text-muted"}`}>{o}{mine && !isCorrect ? " · your answer" : ""}</li>;
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <p className="display text-3xl">Thanks</p>
            <p className="mt-1 text-sm text-muted">{result.xp > 0 ? `+${result.xp.toLocaleString()} XP. ` : ""}Your answers are in.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {questions.map((q, i) => (
        <fieldset key={i} className="card p-4">
          <legend className="sr-only">{q.q}</legend>
          <p className="font-medium">{i + 1}. {q.q}</p>
          <div className="mt-3 grid gap-2">
            {q.options.map((o, j) => (
              <label key={j} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm ${answers[i] === j ? "border-accent bg-accent/10" : "border-line bg-surface-2"}`}>
                <input type="radio" name={`q${i}`} className="accent-[var(--accent)]" checked={answers[i] === j} onChange={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))} />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {questions.length === 0 && <p className="card p-5 text-sm text-muted">This quest has no questions yet.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={!complete || pending || questions.length === 0}>{pending ? "Sending…" : type === "quiz" ? "Submit answers" : "Submit"}</button>
    </form>
  );
}
