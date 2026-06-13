import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export async function ContactReveal({ shootId }: { shootId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_counterparty_email", {
    p_shoot_id: shootId,
  });

  if (error || !data) return null;

  const t = await getTranslations("shootDetail");

  return (
    <section
      data-testid="contact-reveal"
      className="border border-line bg-surface p-6"
    >
      <h2 className="label text-mute">{t("contactTitle")}</h2>
      <p className="mt-2 text-sm text-mute">{t("contactHint")}</p>
      <a
        href={`mailto:${data}`}
        data-testid="contact-email"
        className="mt-4 inline-block text-lg font-semibold tracking-tight text-ink hover:text-accent"
      >
        {data}
      </a>
    </section>
  );
}
