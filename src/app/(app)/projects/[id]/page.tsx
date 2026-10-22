import { Suspense } from "react";
import { CarouselEditor } from "@/components/carousel-editor";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CarouselEditor projectId={id} />
    </Suspense>
  );
}
