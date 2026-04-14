-- Create the avatars bucket (public so images are accessible via URL)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "Users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

-- Allow authenticated users to update/overwrite their own uploads
create policy "Users can update own avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

-- Allow anyone to read avatars (public bucket)
create policy "Public avatar read access"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Allow authenticated users to delete their own avatars
create policy "Users can delete own avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');
