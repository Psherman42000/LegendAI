import { Badge } from "@/components/ui/badge";

export function ProcessingStatus({ status }: { status: string }) {
  const tone = status === "READY" ? "success" : status === "ERROR" ? "danger" : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}
