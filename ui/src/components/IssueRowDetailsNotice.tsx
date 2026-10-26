import { createPortal } from "react-dom";
import { Button } from "./ui/button";

/** Out of document flow so a failed optional read cannot move task rows. */
export function IssueRowDetailsNotice({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  if (!error) return null;
  return createPortal(
    <div role="alert" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg">
      <p>Some task details couldn’t load.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry details</Button>
    </div>, document.body,
  );
}
