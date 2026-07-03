-- Photographer replies to reviews (task S2.4). A reviewed photographer may post
-- a single public reply to a review left about them — standard trust UX that
-- keeps reviews from reading as one-sided. The reply is settable ONCE and only
-- by the reviewed photographer; both guarantees are enforced at the RLS layer.

alter table public.reviews
  add column reply text check (reply is null or char_length(reply) between 1 and 2000),
  add column reply_at timestamptz;

-- Column-scoped UPDATE grant: authenticated users may only ever write these two
-- columns on a review — never the rating, comment, or ownership columns.
grant update (reply, reply_at) on public.reviews to authenticated;

-- Only the reviewed photographer may set the reply, and only while none exists
-- yet. The USING clause is evaluated against the OLD row, so once `reply` is
-- non-null the row is filtered out of the UPDATE entirely — a second reply
-- affects zero rows (settable once, enforced in the database).
create policy "reviews_reply_photographer" on public.reviews
  for update
  using (photographer_id = auth.uid() and reply is null)
  with check (photographer_id = auth.uid());
