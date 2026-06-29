import { useMemo, useState } from "react";
import type {
  FormAnswer,
  FormQuestion,
  FormSubmission,
  FormTemplate,
} from "@/types";
import { createId } from "@/lib/id";
import { usePageHeader } from "../PageHeaderContext";
import { useExitConfirm } from "../runner/useExitConfirm";
import { Slider } from "@/components/ui/slider";

interface Props {
  template: FormTemplate;
  /** When set, pre-fills answers and updates that submission on submit. */
  initialSubmission?: FormSubmission;
  onExit: () => void;
  onSubmit: (submission: FormSubmission) => void;
}

type AnswersMap = Record<string, FormAnswer>;

function initialAnswersFor(
  template: FormTemplate,
  initial?: FormSubmission,
): AnswersMap {
  const map: AnswersMap = {};
  if (!initial) return map;
  for (const a of initial.answers) map[a.questionId] = a;
  // Drop any answers for questions that no longer exist on the template.
  const validIds = new Set<string>();
  for (const s of template.sections) for (const q of s.questions) validIds.add(q.id);
  for (const id of Object.keys(map)) if (!validIds.has(id)) delete map[id];
  return map;
}

function hasAnyAnswer(answers: AnswersMap): boolean {
  return Object.values(answers).some(isAnswered);
}

function isAnswered(a: FormAnswer | undefined): boolean {
  if (!a) return false;
  if (a.type === "text") return a.value.trim().length > 0;
  if (a.type === "multipleChoice") return a.selectedOptionIds.length > 0;
  if (a.type === "numericScale") return typeof a.value === "number" && !Number.isNaN(a.value);
  return false;
}

function missingRequired(
  questions: FormQuestion[],
  answers: AnswersMap,
): string[] {
  return questions
    .filter((q) => q.required && !isAnswered(answers[q.id]))
    .map((q) => q.id);
}

export function FormRunner({ template, initialSubmission, onExit, onSubmit }: Props) {
  const sections = template.sections;
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>(() =>
    initialAnswersFor(template, initialSubmission),
  );
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const isEditing = Boolean(initialSubmission);
  const dirty = hasAnyAnswer(answers);
  // When editing an existing submission, the warning still applies — the
  // user may have modified pre-filled answers and would lose those edits.
  const guarded = isEditing || dirty;

  const { handleBack, sheet } = useExitConfirm(guarded, {
    title: "Exit form?",
    description: "Your answers will not be saved.",
    confirmLabel: "Exit",
    cancelLabel: "Cancel",
    onConfirm: onExit,
  });

  const headerOpts = useMemo(
    () => ({ onBack: handleBack, backIcon: "x" as const }),
    [handleBack],
  );
  usePageHeader(template.name || "Form", headerOpts);

  const section = sections[sectionIndex];
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === sections.length - 1;

  const updateAnswer = (next: FormAnswer) => {
    setAnswers((prev) => ({ ...prev, [next.questionId]: next }));
    if (showRequiredErrors) setShowRequiredErrors(false);
  };

  const goNext = () => {
    if (!section) return;
    const missing = missingRequired(section.questions, answers);
    if (missing.length > 0) {
      setShowRequiredErrors(true);
      return;
    }
    setShowRequiredErrors(false);
    setSectionIndex((i) => Math.min(i + 1, sections.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const goBack = () => {
    setShowRequiredErrors(false);
    setSectionIndex((i) => Math.max(0, i - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleSubmit = () => {
    if (!section) return;
    const missing = missingRequired(section.questions, answers);
    if (missing.length > 0) {
      setShowRequiredErrors(true);
      return;
    }
    const now = new Date().toISOString();
    // Persist answers in template/question order for stability.
    const ordered: FormAnswer[] = [];
    for (const s of sections) {
      for (const q of s.questions) {
        const a = answers[q.id];
        if (a && isAnswered(a)) ordered.push(a);
      }
    }
    const submission: FormSubmission = initialSubmission
      ? {
          ...initialSubmission,
          templateName: template.name,
          answers: ordered,
          updatedAt: now,
        }
      : {
          id: createId("formSub"),
          templateId: template.id,
          templateName: template.name,
          answers: ordered,
          createdAt: now,
          updatedAt: now,
        };
    onSubmit(submission);
  };

  if (!section) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">This form has no sections.</p>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back
          </button>
        </div>
        {sheet}
      </>
    );
  }

  const missingIds = showRequiredErrors
    ? new Set(missingRequired(section.questions, answers))
    : new Set<string>();

  return (
    <>
      <div className="flex flex-col gap-5 pb-24">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Section {sectionIndex + 1} of {sections.length}
          </p>
          {isEditing && (
            <span className="text-xs text-muted-foreground">Editing submission</span>
          )}
        </div>

        <h2 className="text-xl font-semibold">{section.name}</h2>

        <ul className="flex flex-col gap-5">
          {section.questions.map((q) => (
            <QuestionInput
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onChange={updateAnswer}
              showError={missingIds.has(q.id)}
            />
          ))}
        </ul>

        {showRequiredErrors && missingIds.size > 0 && (
          <p className="text-sm text-destructive">
            Please answer all required questions before continuing.
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirst}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-40"
          >
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {isEditing ? "Save changes" : "Submit"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Next
            </button>
          )}
        </div>
      </div>
      {sheet}
    </>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
  showError,
}: {
  question: FormQuestion;
  answer: FormAnswer | undefined;
  onChange: (next: FormAnswer) => void;
  showError: boolean;
}) {
  const errorRing = showError ? "ring-2 ring-destructive" : "";

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">
          {question.prompt || <span className="italic opacity-60">Untitled question</span>}
          {question.required && <span className="ml-1 text-destructive">*</span>}
        </label>
        {question.helpText && (
          <p className="text-xs text-muted-foreground">{question.helpText}</p>
        )}
      </div>

      {question.type === "text" && (
        <TextAnswerInput
          question={question}
          value={answer?.type === "text" ? answer.value : ""}
          errorRing={errorRing}
          onChange={(value) =>
            onChange({ questionId: question.id, type: "text", value })
          }
        />
      )}

      {question.type === "multipleChoice" && (
        <MultipleChoiceInput
          question={question}
          selectedIds={
            answer?.type === "multipleChoice" ? answer.selectedOptionIds : []
          }
          errorRing={errorRing}
          onChange={(selectedOptionIds) =>
            onChange({
              questionId: question.id,
              type: "multipleChoice",
              selectedOptionIds,
            })
          }
        />
      )}

      {question.type === "numericScale" && (
        <NumericScaleInput
          question={question}
          value={answer?.type === "numericScale" ? answer.value : undefined}
          errorRing={errorRing}
          onChange={(value) =>
            onChange({ questionId: question.id, type: "numericScale", value })
          }
        />
      )}
    </li>
  );
}

function TextAnswerInput({
  question,
  value,
  errorRing,
  onChange,
}: {
  question: Extract<FormQuestion, { type: "text" }>;
  value: string;
  errorRing: string;
  onChange: (value: string) => void;
}) {
  const className = `w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring ${errorRing}`;
  if (question.multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        rows={4}
        className={`min-h-[96px] ${className}`}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder}
      className={className}
    />
  );
}

function MultipleChoiceInput({
  question,
  selectedIds,
  errorRing,
  onChange,
}: {
  question: Extract<FormQuestion, { type: "multipleChoice" }>;
  selectedIds: string[];
  errorRing: string;
  onChange: (next: string[]) => void;
}) {
  const multi = question.allowMultiple ?? false;
  const toggle = (optionId: string) => {
    if (multi) {
      onChange(
        selectedIds.includes(optionId)
          ? selectedIds.filter((id) => id !== optionId)
          : [...selectedIds, optionId],
      );
    } else {
      onChange(selectedIds[0] === optionId ? [] : [optionId]);
    }
  };

  return (
    <ul className={`flex flex-col gap-2 rounded-md p-0.5 ${errorRing}`}>
      {question.options.map((opt) => {
        const checked = selectedIds.includes(opt.id);
        return (
          <li key={opt.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={question.id}
                checked={checked}
                onChange={() => toggle(opt.id)}
                className="h-4 w-4"
              />
              <span className="flex-1">{opt.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function NumericScaleInput({
  question,
  value,
  errorRing,
  onChange,
}: {
  question: Extract<FormQuestion, { type: "numericScale" }>;
  value: number | undefined;
  errorRing: string;
  onChange: (value: number) => void;
}) {
  const step = question.step && question.step > 0 ? question.step : 1;

  return (
    <div className={`flex flex-col gap-3 rounded-md p-0.5 ${errorRing}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tabular-nums">
          {value !== undefined ? value : "—"}
        </span>
      </div>
      <Slider
        min={question.min}
        max={question.max}
        step={step}
        value={value !== undefined ? [value] : [question.min]}
        onValueChange={(v) => onChange(v[0])}
      />
      {(question.minLabel || question.maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{question.minLabel ?? ""}</span>
          <span>{question.maxLabel ?? ""}</span>
        </div>
      )}
    </div>
  );
}
