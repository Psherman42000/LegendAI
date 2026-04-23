import { Progress } from "@/components/ui/progress";

export function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-[var(--text-secondary)]">Upload</div>
      <Progress value={progress} />
    </div>
  );
}
