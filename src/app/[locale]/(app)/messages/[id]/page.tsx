import { notFound } from "next/navigation";
import { getThread } from "@/lib/actions/messages";
import { MessageThread } from "@/components/message-thread";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();

  return <MessageThread thread={thread} />;
}
