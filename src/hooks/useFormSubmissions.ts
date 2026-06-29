import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { FormSubmission } from "@/types";

export function useFormSubmissions() {
  const [submissions, setSubmissions] = useLocalStorage<FormSubmission[]>(
    "form-submissions",
    [],
  );

  const addSubmission = useCallback(
    (submission: FormSubmission) => setSubmissions((prev) => [...prev, submission]),
    [setSubmissions],
  );

  const updateSubmission = useCallback(
    (submission: FormSubmission) =>
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submission.id ? submission : s)),
      ),
    [setSubmissions],
  );

  const deleteSubmission = useCallback(
    (id: string) => setSubmissions((prev) => prev.filter((s) => s.id !== id)),
    [setSubmissions],
  );

  return useMemo(
    () => ({
      submissions,
      setSubmissions,
      addSubmission,
      updateSubmission,
      deleteSubmission,
    }),
    [submissions, setSubmissions, addSubmission, updateSubmission, deleteSubmission],
  );
}
