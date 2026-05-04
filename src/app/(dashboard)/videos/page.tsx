import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";
import { Header } from "@/components/dashboard/Header";
import { VideoList } from "@/components/dashboard/VideoList";
import { VideoPagination } from "@/components/dashboard/VideoPagination";

type ApiVideo = {
  id: string;
  title: string;
  status: string;
  duration: number | null;
  fileSize: number | null;
  thumbnailUrl: string | null;
  processedUrl: string | null;
  srtUrl: string | null;
  createdAt: string;
  transcription?: { id: string } | null;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(params.limit ?? "12", 10))
  );
  const search = params.search?.trim() ?? "";

  const cookieHeader = (await headers()).get("cookie") ?? "";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const query = new URLSearchParams();
  query.set("page", String(page));
  query.set("limit", String(limit));
  if (search) query.set("search", search);

  let videos: ApiVideo[] = [];
  let pagination: Pagination = { total: 0, page, limit, totalPages: 0 };
  let fetchError: string | null = null;

  try {
    const res = await fetch(
      `${baseUrl}/api/videos?${query.toString()}`,
      {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      ok: boolean;
      data?: ApiVideo[];
      pagination?: Pagination;
      error?: string;
    };

    if (json.ok) {
      videos = json.data ?? [];
      pagination = json.pagination ?? pagination;
    } else {
      fetchError = json.error ?? "Erro ao carregar vídeos";
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Erro de rede";
  }

  return (
    <main className="space-y-8 p-6 lg:p-10">
      <Header
        title="Meus vídeos"
        description="Lista paginada dos uploads e trabalhos exportados."
        showUploadButton
      />
      <VideoList
        videos={videos}
        search={search}
        limit={limit}
        error={fetchError}
        loading={false}
      />
      {pagination.totalPages > 1 && (
        <VideoPagination pagination={pagination} search={search} />
      )}
    </main>
  );
}
