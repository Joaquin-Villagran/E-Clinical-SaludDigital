import { redirect } from "next/navigation";

export default async function DoctorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/teleconsulta/${id}`);
}