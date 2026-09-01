import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export async function ContactReveal({ shootId }: { shootId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_counterparty_email", {
    p_shoot_id: shootId,
  });

  const t = await getTranslations("shootDetail");

  // No data without an error = the caller isn't entitled (no accepted bid
  // linking the parties) — correctly render nothing. A transient RPC FAILURE
  // is different: silently hiding the section made the core payoff of an
  // accepted bid simply not exist on the page. Show the section with an
  // explanatory line instead.
  if (error) {
    return (
      <section
        data-testid="contact-reveal"
        className="border border-line bg-surface p-6"
      >
        <h2 className="label text-mute">{t("contactTitle")}</h2>
        <p className="mt-2 text-sm text-accent">{t("contactError")}</p>
      </section>
    );
  }
  if (!data) return null;

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
