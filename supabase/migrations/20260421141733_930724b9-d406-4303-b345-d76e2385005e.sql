insert into storage.buckets (id, name, public)
values ('meditation-artwork', 'meditation-artwork', true)
on conflict (id) do nothing;

create policy "Anyone can view meditation artwork"
on storage.objects for select
using (bucket_id = 'meditation-artwork');

create policy "Authenticated can upload meditation artwork"
on storage.objects for insert
to authenticated
with check (bucket_id = 'meditation-artwork');

create policy "Service role can manage meditation artwork"
on storage.objects for all
to service_role
using (bucket_id = 'meditation-artwork')
with check (bucket_id = 'meditation-artwork');