import type { UseWorkoutAudioResult } from "@/hooks/useWorkoutAudio";

/** Mute / unmute toggle for the workout runner. Designed to live in the
 *  AppShell header's right slot via PageHeaderContext.headerRight. */
export function MuteButton({ audio }: { audio: UseWorkoutAudioResult }) {
  return (
    <button
      type="button"
      onClick={audio.toggleMute}
      aria-label={audio.muted ? "Unmute audio" : "Mute audio"}
      aria-pressed={audio.muted}
      className="rounded-full p-1.5 opacity-80 hover:opacity-100"
    >
      {audio.muted ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
