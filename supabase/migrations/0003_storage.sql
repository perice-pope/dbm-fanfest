-- Buckets: proofs is private (fan uploads), media is public (reward, news and featured images).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;

-- Path convention: <channel uuid>/<fan uuid>/<file>.jpg
create policy "proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "proofs read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin(((storage.foldername(name))[1])::uuid)));
create policy "proofs admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin(((storage.foldername(name))[1])::uuid));
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin(((storage.foldername(name))[1])::uuid));
