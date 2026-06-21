import { usePageHeader } from "./PageHeaderContext";

interface HelpScreenProps {
  onBack: () => void;
}

export function HelpScreen({ onBack }: HelpScreenProps) {
  usePageHeader("Help", { onBack, backIcon: "chevron" });

  return (
    <div className="space-y-8 pb-4">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Quick Start</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Jump straight into a standalone timer: Stopwatch (count up, stop when
          done), AMRAP (as many rounds as possible within a time cap), EMOM
          (every minute on the minute), or Circuit (work and rest intervals).
          Minimal setup, and nothing is logged to your diary.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Workouts</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A workout contains sections. Each section contains exercises.
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">
            The four section types
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
            <li>
              <span className="font-medium text-foreground">Sets:</span>{" "}
              complete all sets of each exercise before moving to the next.
            </li>
            <li>
              <span className="font-medium text-foreground">Circuit:</span>{" "}
              cycle through the exercises in sequence, then repeat for each
              round.
            </li>
            <li>
              <span className="font-medium text-foreground">Stopwatch:</span>{" "}
              work through the exercises at your own pace and stop the timer
              when done.
            </li>
            <li>
              <span className="font-medium text-foreground">Time Cap:</span>{" "}
              cycle through the exercises as many times as you can before time
              runs out.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Timed vs self-paced (Circuit and Sets only)
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sets and Circuit sections can be either timed, with work and rest
            intervals, or presented as a list of exercises with rep targets, no
            timer, to be worked at your own pace.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">Coach notes</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Any section, or the whole workout, can include notes: how to
            perform it, scaling options, cues. These show right before you
            start.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Building and sharing your own workouts
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Anyone can build a workout in the app. Once built, you can export
            it and share it with someone else, who can then import it into
            their own copy of the app.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Diary</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Where your session history lives, including any notes you add
          afterwards.
        </p>
      </section>
    </div>
  );
}
