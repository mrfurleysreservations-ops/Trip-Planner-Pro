-- Allow users to read families owned by their accepted friends
-- (The existing policy only allows owner_id = auth.uid())

CREATE POLICY "Users can view friends families"
  ON public.families FOR SELECT
  USING (
    owner_id = auth.uid()
    OR owner_id IN (
      SELECT friend_id FROM friend_links WHERE user_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT user_id FROM friend_links WHERE friend_id = auth.uid() AND status = 'accepted'
    )
  );

-- Allow users to read family_members of families they can see
CREATE POLICY "Users can view friends family members"
  ON public.family_members FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM families WHERE owner_id = auth.uid()
    )
    OR family_id IN (
      SELECT id FROM families WHERE owner_id IN (
        SELECT friend_id FROM friend_links WHERE user_id = auth.uid() AND status = 'accepted'
        UNION
        SELECT user_id FROM friend_links WHERE friend_id = auth.uid() AND status = 'accepted'
      )
    )
  );
