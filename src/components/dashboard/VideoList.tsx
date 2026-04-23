import { VideoCard } from "./VideoCard";

const videos = [
  { title: "Reels sobre lançamento", status: "PRONTO" as const, duration: "2m32s" },
  { title: "Tutorial de vendas", status: "PROCESSANDO" as const, duration: "8m10s" },
  { title: "Cortes do podcast", status: "ERRO" as const, duration: "11m00s" },
];

export function VideoList() {
  return (
    <div className="grid gap-4">
      {videos.map((video) => (
        <VideoCard key={video.title} {...video} />
      ))}
    </div>
  );
}
